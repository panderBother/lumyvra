"""Prepare original speech+score conditioning in the isolated guide environment."""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.original_score import render_blueprint  # noqa: E402
from music_service.vocal_guide import render_phrase  # noqa: E402
from music_service.vocal_guide_score import score  # noqa: E402

folder = root / "data/evaluation/vocal-guide-study-20261012"
speech = folder / "speech-16k"
manifest = json.loads((speech / "manifest.json").read_text(encoding="utf-8"))
phrases = {p["text"]: p for p in manifest["phrases"]}
model = folder / "model-16k"
blueprint = render_blueprint(model, score(), render_lead=False)
shutil.copyfile(model / "guide.wav", model / "accompaniment.wav")
background, rate = sf.read(model / "accompaniment.wav", dtype="float64", always_2d=True)
voice = np.zeros(len(background), dtype=np.float64)
cached, checks = {}, []
for section in blueprint["sections"]:
    for i, text in enumerate(section["sungLines"]):
        notes = [n for n in blueprint["notes"] if n["section"] == section["name"] and n["line"] == i]
        item = phrases[text]
        key = (text, tuple((n["midi"], n["beat"] - notes[0]["beat"], n["beats"]) for n in notes))
        if key not in cached:
            audio, source_rate = sf.read(item["audio"], dtype="float64")
            marks = json.loads(Path(item["marks"]).read_text(encoding="utf-8"))
            source = render_phrase(audio, source_rate, text, marks, notes, blueprint["bpm"])
            cached[key] = resample_poly(source, rate, source_rate)
        sung = cached[key]
        start = round(notes[0]["beat"] * 60 / blueprint["bpm"] * rate)
        stop = min(len(voice), start + len(sung))
        voice[start:stop] += sung[:stop - start]
        checks.append({"section": section["name"], "line": i, "characters": len(text),
                       "notes": len(notes), "sourceWordTiming": True, "charInsideWordTiming": "estimated",
                       "wordPreservationChecked": True})
peak = float(np.max(np.abs(voice)))
if peak < .001 or not np.isfinite(voice).all():
    raise ValueError("Original vocal conditioning failed")
voice *= .42 / peak
sf.write(model / "synthetic-vocal-guide.wav", voice, rate, subtype="PCM_16")
mixed = background * .32 + np.column_stack([voice, voice])
mixed *= .75 / max(float(np.max(np.abs(mixed))), .75)
sf.write(model / "guide.wav", mixed, rate, subtype="PCM_16")
report = {"title": blueprint["title"], "seconds": blueprint["seconds"], "voice": manifest["voice"],
          "method": "offline SAPI speech -> WORLD note/time resynthesis -> original accompaniment",
          "phraseChecks": checks, "modelOutput": False, "humanReview": "pending", "glmCalls": 0,
          "cloudTtsCalls": 0, "commercialAudioUsed": False,
          "limits": "Word timings from speech engine, syllables inside words estimated. This is conditioning audio, "
                    "not a professional singing model, forced phoneme alignment or delivered song."}
(model / "guide-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"prepared": True, "seconds": blueprint["seconds"], "originalSungLines": len(checks),
                  "cloudTtsCalls": 0, "glmCalls": 0, "modelOutput": False}), flush=True)
