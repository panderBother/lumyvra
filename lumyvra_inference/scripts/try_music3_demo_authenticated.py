"""One authenticated publisher-demo trial using the user's permitted free quota.

Read HF_TOKEN privately from .env, never request a paid provider or retry quota
errors. No automatic engine switch. --prepare-only requires no account or SDK.
"""
import argparse
import inspect
import json
import re
import shutil
import sys
import time
from concurrent.futures import TimeoutError
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))


def excerpt(lyrics: str) -> str:
    """First verse, transition and chorus from the project's own original lyrics."""
    result, seen, keep = [], set(), False
    for line in lyrics.splitlines():
        if re.fullmatch(r"\[[^\]]+\]", line):
            role = line[1:-1]
            keep = role in {"intro", "verse", "pre-chorus", "chorus", "outro"} and role not in seen
            if keep:
                seen.add(role)
        if keep:
            result.append(line)
    return "\n".join(result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--seconds", type=int, choices=(72, 120), default=72)
    args = parser.parse_args()
    parent = root / "data/evaluation/minimax-music3-online-20261012"
    fixture = json.loads((parent / "trial-input.json").read_text(encoding="utf-8"))
    data = fixture["payload"]["data"]
    data[1] = args.seconds
    if args.seconds == 72:
        data[0]["lyrics"] = excerpt(data[0]["lyrics"])
        data[0]["arrangement"] = (
            "Warm piano and clean guitar open sparsely. Bass and a clear kick/snare pocket support the verse. "
            "The pre-chorus gathers emotion with connected vocal phrases, then briefly gives the bass space. "
            "A fuller drum and bass pattern supports the chorus, with a recognizable recurring opening melody, "
            "held important words and a falling answer. Keep the lead words clear, put instrumental answers only "
            "in vocal rests, and end with a short resolving outro."
        )
    from music_service.performance import content
    if args.seconds == 120:
        original = (root / "data/evaluation/vocal-guide-study-20261012/model-16k/lyrics.txt").read_text(encoding="utf-8")
        assert content(data[0]["lyrics"]) == content(original)
    if args.prepare_only:
        print(json.dumps({"ready": True, "space": fixture["space"], "requestedSeconds": args.seconds,
                          "sungCharacters": len(content(data[0]["lyrics"])), "requiresHfAccountQuota": True,
                          "modelRequestsSent": 0, "paidApiCalls": 0}), flush=True)
        return
    from dotenv import dotenv_values
    token = dotenv_values(root / ".env").get("HF_TOKEN") or ""
    if not token:
        raise SystemExit("Missing HF_TOKEN in inference .env; no model request sent")
    folder = parent / f"authenticated-{args.seconds}s"
    if folder.exists():
        raise SystemExit("Preserve existing trial; no automatic resubmission")
    folder.mkdir()
    (folder / "input.json").write_text(json.dumps({"space": fixture["space"], "data": data,
                                                 "authentication": "user-supplied HF_TOKEN; not stored"},
                                                ensure_ascii=False, indent=2), encoding="utf-8")
    report = {"model": fixture["space"], "requestedSeconds": args.seconds, "status": "not_submitted",
              "paidApiCalls": 0, "glmCalls": 0, "modelDownloads": 0, "humanReview": "pending",
              "websiteProviderChanged": False, "quotaBypassAttempted": False,
              "limits": "A publisher demo with daily quotas; not a stable production API or taste guarantee."}
    started, job = time.monotonic(), None
    try:
        from gradio_client import Client
        parameters = inspect.signature(Client).parameters
        auth_name = "token" if "token" in parameters else "hf_token"
        options = {auth_name: token, "verbose": False, "max_workers": 1,
                   "download_files": str(folder / "sdk-output"), "httpx_kwargs": {"timeout": 35}}
        if "analytics_enabled" in parameters:
            options["analytics_enabled"] = False
        client = Client(fixture["space"], **options)
        job = client.submit(*data, api_name=fixture["endpoint"])
        report["status"] = "submitted"
        print(json.dumps({"submitted": True, "model": fixture["space"], "requestedSeconds": args.seconds,
                          "usesUserHfQuota": True, "paidApiCalls": 0}), flush=True)
        while True:
            remaining = 480 - (time.monotonic() - started)
            if remaining <= 0:
                job.cancel()
                raise TimeoutError("Bounded demo trial timed out")
            try:
                result = job.result(timeout=min(20, remaining))
                break
            except TimeoutError:
                print(json.dumps({"waitingSeconds": round(time.monotonic() - started)}), flush=True)
        if not isinstance(result, (list, tuple)) or len(result) < 3:
            raise ValueError("Invalid publisher result")
        file_result = result[2]
        file_name = file_result.get("path", "") if isinstance(file_result, dict) else file_result
        asset = Path(file_name).resolve()
        if not asset.is_relative_to(folder.resolve()) or not asset.is_file():
            raise ValueError("Result is not a locally retrieved generated artifact")
        target = folder / "song.wav"
        shutil.copyfile(asset, target)
        import soundfile as sf
        from music_service.audio import inspect_audio
        info = sf.info(target)
        report["audio"] = inspect_audio(target, round(info.duration))
        report["path"] = str(target)
        report["status"] = "succeeded"
        report["earlyEndPossible"] = True
        report["usedSeed"] = result[3] if len(result) >= 4 else None
    except Exception as exc:
        report["status"] = "failed"
        report["errorType"] = type(exc).__name__
        error = str(exc).replace(token, "[redacted]")
        error = re.sub(r"hf_[A-Za-z0-9]+", "[redacted]", error)
        report["error"] = error[:1000]
    finally:
        report["elapsedSeconds"] = time.monotonic() - started
        (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k not in {"error", "limits"}}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
