"""Validate planning output and return bounded, input-free repair instructions."""
import re

from pydantic import ValidationError

from .performance import plan_performance
from .schemas import ProductionPlan, SongRequest

FIELDS = set(ProductionPlan.model_fields) | {"label", "start_line", "end_line"}


class PlanValidationFailure(ValueError):
    def __init__(self, issues: list[dict]):
        self.issues = issues
        super().__init__("Production plan validation failed")


def parse_plan(content: str) -> ProductionPlan:
    if not isinstance(content, str):
        raise PlanValidationFailure([{"code": "JSON_REQUIRED", "field": "response"}])
    text = content.removeprefix("\ufeff").strip()
    # Only unwrap a fence enclosing the entire answer. Do not extract arbitrary
    # objects from prose, silently drop unknown fields or truncate model output.
    if fenced := re.fullmatch(r"```(?:json)?\s*\n([\s\S]*?)\n```", text, re.I):
        text = fenced[1].strip()
    try:
        return ProductionPlan.model_validate_json(text)
    except ValidationError as exc:
        issues = []
        for error in exc.errors()[:12]:
            loc = error["loc"]
            # Unknown field names and validation inputs can contain arbitrary
            # provider text. Diagnostic fields must not copy those values.
            field = ".".join(str(part) if isinstance(part, int) or part in FIELDS else "unknown_field"
                             for part in loc) or "response"
            issue = {"code": error["type"], "field": field}
            for key in ("max_length", "min_length", "ge", "le"):
                if isinstance(value := error.get("ctx", {}).get(key), (int, float)):
                    issue[key] = value
            issues.append(issue)
        raise PlanValidationFailure(issues) from None


def validate_plan(plan: ProductionPlan, song: SongRequest, budget: dict, *, needs_sections: bool,
                  sung_content) -> None:
    issues = []
    if song.mode == "lyrics" and plan.lyrics != song.prompt:
        issues.append({"code": "LOCKED_LYRICS_CHANGED", "field": "lyrics"})
    if song.instrumental and plan.lyrics:
        issues.append({"code": "INSTRUMENTAL_LYRICS", "field": "lyrics"})
    if not song.instrumental and not plan.lyrics.strip():
        issues.append({"code": "EMPTY_LYRICS", "field": "lyrics"})
    if needs_sections and not plan.sections:
        issues.append({"code": "SECTION_MAP_REQUIRED", "field": "sections"})
    if not needs_sections and plan.sections:
        issues.append({"code": "UNEXPECTED_SECTIONS", "field": "sections"})
    try:
        plan_performance(plan.model_dump(), instrumental=song.instrumental)
    except ValueError:
        issues.append({"code": "INVALID_PERFORMANCE_LAYOUT", "field": "sections"})
    if song.mode != "lyrics" and not song.instrumental:
        lines, characters = sung_content(plan.lyrics)
        if lines > budget["maxSungLines"] or characters > budget["maxSungCharacters"]:
            issues.append({"code": "LYRIC_BUDGET_EXCEEDED", "field": "lyrics", "sungLines": lines,
                           "sungCharacters": characters, "maxSungLines": budget["maxSungLines"],
                           "maxSungCharacters": budget["maxSungCharacters"]})
    if re.search(r"\b(?:female\s+or\s+male|male\s+or\s+female)\b", plan.caption, re.I):
        issues.append({"code": "AMBIGUOUS_SINGER", "field": "caption"})
    if issues:
        raise PlanValidationFailure(issues)


REPAIRS = {
    "LOCKED_LYRICS_CHANGED": "lyrics必须逐字复制原始prompt，包括换行和标点，不能润色或加标签。",
    "INSTRUMENTAL_LYRICS": "纯音乐的lyrics必须是空字符串，caption不能包含演唱。",
    "EMPTY_LYRICS": "演唱歌曲必须输出非空歌词，并服从lyricBudget。",
    "SECTION_MAP_REQUIRED": "未分段锁定歌词的sections必须按indexedLyricLines零基索引、末端不含，连续完整覆盖每行一次。",
    "UNEXPECTED_SECTIONS": "已有标签、新写歌词或纯音乐的sections必须为[]。",
    "INVALID_PERFORMANCE_LAYOUT": "sections只能使用允许的label，范围按indexedLyricLines顺序覆盖一次，不重叠、不遗漏；不能改原词。",
    "AMBIGUOUS_SINGER": "caption只能选择一种主唱声线，不能写female or male。",
}


def repair_instruction(issues: list[dict]) -> str:
    messages = ["输出校验失败。只返回完整JSON对象，不加解释或Markdown。请针对下列具体问题修复，其他用户要求保持。"]
    for issue in issues:
        if issue["code"] == "LYRIC_BUDGET_EXCEEDED":
            messages.append(f"lyrics当前{issue['sungLines']}行、{issue['sungCharacters']}个演唱字符；"
                            f"最多{issue['maxSungLines']}行、{issue['maxSungCharacters']}字符。"
                            "精简自动生成的完整词句，包含重复副歌的全部字数，留前后奏与换气；不能机械截断。")
        elif issue["code"] in REPAIRS:
            messages.append(REPAIRS[issue["code"]])
        else:
            limits = "，".join(f"{key}={issue[key]}" for key in ("max_length", "min_length", "ge", "le") if key in issue)
            messages.append(f"字段{issue['field']}：{issue['code']}" + (f"（{limits}）" if limits else "") + "；请遵守字段定义。")
    return "\n".join(dict.fromkeys(messages))
