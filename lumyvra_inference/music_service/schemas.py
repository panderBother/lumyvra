from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SongRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str = Field(pattern=r"^job-[a-f0-9]{24}$")
    mode: Literal["text", "lyrics", "words"]
    prompt: str = Field(min_length=1, max_length=4096)
    style_prompt: str = Field(default="", max_length=512)
    genre: str = Field(max_length=32)
    mood: str = Field(max_length=32)
    seconds: int = Field(ge=30, le=240)
    instrumental: bool = False
    seed: int | None = Field(default=None, ge=0, le=2147483647)

    @model_validator(mode="after")
    def valid_mode(self):
        if self.mode != "lyrics" and len(self.prompt) > 2000:
            raise ValueError("主题最多 2000 字符")
        if self.instrumental and self.mode != "text":
            raise ValueError("歌词生成与纯音乐不能同时选择")
        return self


class PerformanceSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Literal["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro", "Instrumental"]
    start_line: int = Field(ge=0, strict=True)
    end_line: int = Field(ge=1, strict=True)


class ProductionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=40)
    lyrics: str = Field(max_length=4096)
    caption: str = Field(min_length=1, max_length=512)
    bpm: int | None = Field(default=None, ge=40, le=240)
    key: str = Field(default="", max_length=24)
    vocal_language: Literal["zh", "en", "unknown"] = "zh"
    # Zero-based, end-exclusive ranges of conservative singing lines. Saved lyrics stay exact.
    sections: list[PerformanceSection] = Field(default_factory=list, max_length=24)


class ServiceFailure(Exception):
    def __init__(self, code: str, message: str, *, diagnostics: dict | None = None):
        self.code = code
        self.message = message
        self.diagnostics = diagnostics
        super().__init__(message)
