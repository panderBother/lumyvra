"""Separate saved lyric text from a conservative, word-preserving singing layout.

Shared by the music LM and DiT; stdlib only for both isolated environments.
Section labels and breaks are soft conditions, not forced lyric/audio alignment.
"""
import hashlib
import re

VERSION = "performance-layout-v2"
TAG = re.compile(r"^\s*\[[^\]\n]+\]\s*$")
LABELS = {"Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro", "Instrumental"}


def source_lines(lyrics):
    return [line.strip() for line in lyrics.splitlines() if line.strip()]


def has_tags(lyrics):
    return any(TAG.fullmatch(line) for line in lyrics.splitlines())


def content(lyrics):
    # Ignore layout and standalone instruction tags, retain every word and punctuation mark.
    return re.sub(r"\s+", "", "".join(line for line in lyrics.splitlines() if not TAG.fullmatch(line)))


def reflow(line):
    if TAG.fullmatch(line) or len(re.sub(r"\s+", "", line)) <= 14:
        return [line]
    # Only existing phrase boundaries. No arbitrary character wrapping or cutting words.
    return [part.strip() for part in re.split(r"(?<=[，,。！？!?；;])", line) if part.strip()]


def singing_lines(lyrics):
    return [phrase for line in source_lines(lyrics) for phrase in reflow(line)]


def validate_sections(lyrics, sections):
    if not sections:
        return
    if has_tags(lyrics):
        raise ValueError("Existing lyric section tags must not be overridden")
    lines, cursor = singing_lines(lyrics), 0
    if len(sections) > 24:
        raise ValueError("Too many performance sections")
    for section in sections:
        start, end = section.get("start_line"), section.get("end_line")
        if (section.get("label") not in LABELS or type(start) is not int or type(end) is not int
                or start != cursor or not start < end <= len(lines)):
            raise ValueError("Section ranges must cover indexed singing lines once, in order")
        cursor = end
    if cursor != len(lines):
        raise ValueError("Section map leaves lyrics uncovered")


def prepare_performance(lyrics, sections=(), *, instrumental=False):
    if instrumental and (lyrics or sections):
        raise ValueError("Instrumental performance cannot contain sung lyrics")
    validate_sections(lyrics, sections)
    lines = singing_lines(lyrics)
    prepared = []
    if sections:
        if sections[0]["label"] != "Intro":
            prepared.append("[Intro]")
        for section in sections:
            prepared.append("[" + section["label"] + "]")
            prepared.extend(lines[section["start_line"]:section["end_line"]])
        if sections[-1]["label"] != "Outro":
            prepared.append("[Outro]")
    else:
        prepared.extend(lines)
    # Standalone role tags start a new paragraph in both model stages. The old
    # flattening discarded GLM's blank boundaries, including verse/chorus breaks.
    layout = []
    for line in prepared:
        if TAG.fullmatch(line) and layout:
            layout.append("")
        layout.append(line)
    singing = "\n".join(layout)
    if content(lyrics) != content(singing):
        raise ValueError("Performance layout changed lyric content")
    sung_lines = [line for line in prepared if not TAG.fullmatch(line)]
    metadata = {"version": VERSION, "sourceSha256": hashlib.sha256(lyrics.encode("utf-8")).hexdigest(),
                "preparedSha256": hashlib.sha256(singing.encode("utf-8")).hexdigest(),
                "sourceLines": sum(not TAG.fullmatch(line) for line in source_lines(lyrics)),
                "singingLines": len(sung_lines), "longestSingingLine": max(map(len, sung_lines), default=0),
                "sectionMapUsed": bool(sections), "existingTags": has_tags(lyrics),
                "contentPreserved": True, "conditioning": "soft-text", "humanReview": "pending"}
    metadata["sectionParagraphs"] = sum(bool(TAG.fullmatch(line)) for line in prepared)
    return singing, metadata


def plan_performance(plan, *, instrumental=False):
    return prepare_performance(plan["lyrics"], plan.get("sections", ()), instrumental=instrumental)
