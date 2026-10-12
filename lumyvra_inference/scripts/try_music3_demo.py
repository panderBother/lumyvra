"""One anonymous trial through the publisher's public demo; never a production backend.

No GLM/paid API/account token is used. Honor quota/login errors without retries or
workarounds. Original lyrics only; preserve every previous output and service.
"""
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.audio import inspect_audio  # noqa: E402

HOST = "https://minimaxai-minimax-music3.hf.space"
folder = root / "data/evaluation/minimax-music3-online-20261012"
input_path, report_path = folder / "trial-input.json", folder / "trial-report.json"
if input_path.exists() or report_path.exists():
    raise SystemExit("Preserve earlier trial; no automatic resubmission")
original = (root / "data/evaluation/vocal-guide-study-20261012/model-16k/lyrics.txt").read_text(encoding="utf-8")
# Canonical section tags only; the original words are retained exactly.
lyrics = re.sub(r"(?m)^\[(Verse|Pre-Chorus|Chorus) [12]\]$", lambda m: "[" + m[1].lower() + "]", original)
lyrics = lyrics.replace("[Intro]", "[intro]").replace("[Outro]", "[outro]")
state = {"mode": "studio", "description": "A melodic Mandarin pop song about returning home after a difficult rainy day.",
         "instrumental": False, "title": "留一盏灯",
         "lyrics": lyrics,
         "global_meta": "Basic Attributes: 80 BPM, G major, melodic Mandarin pop with a gentle pop-R&B pulse. "
                        "Emotional progression: a tired and restrained verse becomes a relieved, emotionally open chorus. "
                        "A coherent recurring chorus melody, natural phrase shapes and a resolving ending. "
                        "Present vocals, clear midrange, restrained reverb and a defined rhythm section.",
         "vocals": "Vocal Gender and Timbre: one warm natural male lead in a comfortable middle register. "
                   "Vocal Style: clear Mandarin syllables and connected melodic singing, restrained conversational verses "
                   "then expressive chorus phrasing with held key words and a gentle falling answer. "
                   "Keep the recurring opening melody recognizable. Few vocal runs, natural breaths, no crowd chanting. "
                   "Backing vocals: only a subtle chorus layer, with the lead words still clear.",
         "arrangement": "Warm piano and clean picked guitar begin sparsely. Soft bass and a clear kick/snare pocket "
                        "support the verse. The pre-chorus briefly gives the bass space, then a fuller drum and bass "
                        "pattern supports a connected, melodic chorus. The second verse relaxes; the final chorus "
                        "retains its vocal theme and adds one instrumental answer in vocal rests. Resolve into a short outro."}
payload = {"data": [state, 120, 20261012, False, 0, 30, 1.7]}
input_path.write_text(json.dumps({"space": "MiniMaxAI/MiniMax-Music3", "endpoint": "/studio_generate", "payload": payload,
                                "authentication": "anonymous", "lyricsSource": "original project lyrics"},
                               ensure_ascii=False, indent=2), encoding="utf-8")
report = {"model": "MiniMaxAI/MiniMax-Music3", "status": "not_submitted", "paidApiCalls": 0,
          "glmCalls": 0, "modelDownloads": 0, "loginBypassAttempted": False, "humanReview": "pending",
          "websiteProviderChanged": False, "limits": "Publisher demo and quotas are not a production SLA. "
                                               "Same original words, but model and production description differ; not a controlled A/B."}
started = time.monotonic()
try:
    timeout = httpx.Timeout(35, connect=12)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        response = client.post(HOST + "/gradio_api/call/studio_generate", json=payload)
        report["submitStatusCode"] = response.status_code
        response.raise_for_status()
        event_id = response.json()["event_id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", event_id):
            raise ValueError("Invalid event identifier")
        report["status"] = "submitted"
        print(json.dumps({"submitted": True, "model": report["model"], "requestedSeconds": 120,
                          "paidApiCalls": 0, "anonymous": True}), flush=True)
        event, file_data = "", None
        with client.stream("GET", HOST + "/gradio_api/call/studio_generate/" + event_id) as stream:
            stream.raise_for_status()
            for line in stream.iter_lines():
                if time.monotonic() - started > 480:
                    report["status"] = "trial_wait_timeout"
                    break
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:") and event in {"error", "complete"}:
                    data = json.loads(line[5:].strip())
                    if event == "error":
                        report["status"] = "rejected_by_service"
                        report["serviceError"] = re.sub(r"hf_[A-Za-z0-9]+", "[redacted]", str(data))[:1000]
                    else:
                        if isinstance(data, list) and len(data) >= 3 and isinstance(data[2], dict):
                            file_data = data[2]
                            report["usedSeed"] = data[3] if len(data) >= 4 else None
                        if not file_data:
                            report["status"] = "output_missing"
                    break
        if file_data:
            url = file_data.get("url") or ""
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.netloc != urlparse(HOST).netloc or not parsed.path.startswith("/gradio_api/file="):
                raise ValueError("Returned file URL does not belong to the publisher demo")
            # Retrieve only this newly generated result, never reference recordings
            # or example songs. The returned local artifact can be inspected/played.
            target = folder / "song.wav"
            with client.stream("GET", url) as audio:
                audio.raise_for_status()
                size = 0
                with target.open("xb") as handle:
                    for block in audio.iter_bytes(65536):
                        size += len(block)
                        if size > 150_000_000:
                            raise ValueError("Generated result exceeds expected audio size")
                        handle.write(block)
            import soundfile as sf
            info = sf.info(target)
            report["audio"] = inspect_audio(target, round(info.duration))
            report["requestedSeconds"] = 120
            report["earlyEndPossible"] = True
            report["status"] = "succeeded"
            report["path"] = str(target)
except Exception as exc:
    if report["status"] != "rejected_by_service":
        report["status"] = "failed"
    report["errorType"] = type(exc).__name__
finally:
    report["elapsedSeconds"] = time.monotonic() - started
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k not in {"serviceError", "limits"}}, ensure_ascii=False), flush=True)
