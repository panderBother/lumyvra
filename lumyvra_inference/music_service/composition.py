"""Validate the pinned ACE 5Hz semantic-code boundary before diffusion."""
import hashlib
import json
import re
from pathlib import Path

if __package__:
    from .performance import plan_performance
else:
    from performance import plan_performance


def composition_fingerprint(plan: dict, request: dict) -> str:
    """Bind cached codes to their actual music and singing conditions."""
    singing, _ = plan_performance(plan, instrumental=request["instrumental"])
    conditions = {"caption": plan["caption"], "lyrics": singing, "bpm": plan.get("bpm"),
                  "key": plan.get("key", ""), "language": plan["vocal_language"],
                  "seconds": request["seconds"], "instrumental": request["instrumental"],
                  "seed": request["seed"]}
    return hashlib.sha256(json.dumps(conditions, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def read_cached_composition(payload: dict) -> dict | None:
    """Private comparisons only: reuse one local LM pass, never foreign codes."""
    if not payload.get("compositionFile"):
        return None
    if payload.get("compositionModel") or payload.get("melodyGuide") or payload.get("approvedReference"):
        raise ValueError("Cached composition cannot be combined with another source")
    folder = Path(payload["outputDir"]).resolve()
    source = Path(payload["compositionFile"]).resolve()
    if not source.is_relative_to(folder) or not source.is_file() or source.stat().st_size > 256_000:
        raise ValueError("Cached composition must be a bounded local file inside its output directory")
    cached = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(cached, dict) or cached.get("inputFingerprint") != composition_fingerprint(
            payload["plan"], payload["request"]):
        raise ValueError("Cached composition conditions do not match this request")
    validate_audio_codes(cached.get("audioCodes"), payload["request"]["seconds"])
    return cached


def code_condition_strength(payload: dict) -> float:
    value = payload.get("compositionStrength", 1.0)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0.25 <= value <= 1.0:
        raise ValueError("Composition strength must be finite and between 0.25 and 1")
    if value != 1.0 and not (payload.get("compositionModel") or payload.get("compositionFile")):
        raise ValueError("Composition strength requires actual music codes")
    return float(value)


def validate_audio_codes(codes: str, seconds: int) -> int:
    if not isinstance(codes, str) or not re.fullmatch(r"(?:<\|audio_code_\d{1,5}\|>)+", codes):
        raise ValueError("Invalid semantic music codes")
    values = re.findall(r"<\|audio_code_(\d+)\|>", codes)
    if len(values) != seconds * 5 or any(int(value) > 63999 for value in values):
        raise ValueError("Semantic music codes do not match the requested duration or codebook")
    return len(values)
