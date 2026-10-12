"""Generate one full original song using the locally approved B hook.

No GLM calls or downloads. --run needs the idle API stopped first: the same
exclusive GPU lock is held until the owned inference process has exited.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.audio import inspect_audio  # noqa: E402
from music_service.hook_song import fingerprint, render_full_guide  # noqa: E402
from music_service.hook_transition import render_transition_guide  # noqa: E402
from music_service.processes import terminate_owned_tree  # noqa: E402
from music_service.settings import Settings  # noqa: E402
from music_service.worker import native_failure_code  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true", help="Actually generate a full song; otherwise only prepare its guide.")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--preview", action="store_true", help="One-minute verse-to-chorus study instead of a full song.")
    parser.add_argument("--cover-strength", type=float, default=.65)
    parser.add_argument("--source", type=Path, default=root / "data/evaluation/reference-hooks-20261011-dtype/b/song.wav")
    args = parser.parse_args()
    if not math.isfinite(args.cover_strength) or not 0 < args.cover_strength <= 1:
        parser.error("cover-strength must be finite and in (0, 1]")
    settings = Settings()
    folder = (args.output or settings.inference_data_dir / "evaluation" /
              (("approved-b-transition-" if args.preview else "approved-b-full-")
               + datetime.now().strftime("%Y%m%d-%H%M%S"))).resolve()
    lock = None
    try:
        if args.run:
            lock = (settings.inference_data_dir / "service.lock").open("r+b")
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        renderer = render_transition_guide if args.preview else render_full_guide
        blueprint = renderer(folder, args.source)
        seconds = blueprint["seconds"]
        caption = (
            "Mandarin pop R&B, 112 BPM, C major, intimate female lead singing the supplied lyrics. "
            "Keep the chorus hook and vocal character of the approved reference. "
            "Forward syncopated electric bass, crisp kick and rimshot, warm Rhodes chords. "
            "Short instrumental intro, lower-register conversational verses, rising pre-chorus, "
            "memorable four-line chorus with its answering phrase, short instrumental post-chorus. "
            "Second verse advances the conversation. A restrained bridge, then a double final chorus "
            "with fuller harmonies, resolving instrumental outro. Clear Chinese diction and spaces to breathe. "
            "Turn the synthetic guide notes in the verses into singing; no lead synth doubling the entire vocal. "
            "One coherent complete song, keep its pulse and consistent singer through every section.")
        if args.preview:
            caption = (
                "Mandarin pop-R&B, 112 BPM, C major, clear female lead. "
                "Sparse conversational verse, Rhodes and light drums; pre-chorus builds, then a breath. "
                "Keep the chorus melody and its answering phrase from the source audio. "
                "Full kick, rimshot and syncopated bass enter at the chorus. "
                "Repeat the hook, few vocal runs, resolve the final phrase. "
                "Sing the supplied Mandarin lyrics; turn verse guide notes into vocals.")
        payload = {"request": {"seed": 20261011, "seconds": seconds, "instrumental": False},
                   "plan": {"title": blueprint["title"], "caption": caption, "lyrics": blueprint["lyrics"],
                            "bpm": blueprint["bpm"], "key": blueprint["key"], "vocal_language": "zh"},
                   "aceRoot": str(settings.inference_ace_root.resolve()),
                   "checkpoints": str(settings.inference_checkpoints_dir.resolve()),
                   "model": settings.inference_model, "device": settings.inference_device,
                   "compositionModel": "", "melodyGuide": str(folder / "guide.wav"),
                   "approvedReference": str(folder / "approved-b.wav"), "audioCoverStrength": args.cover_strength,
                   "servicePid": os.getpid(), "outputDir": str(folder)}
        source, result_file = folder / "input.json", folder / "result.json"
        source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"folder": str(folder), "seconds": seconds, "glmCalls": 0,
                          "mode": "actual-inference" if args.run else "guide-only"}), flush=True)
        if not args.run:
            return
        started, process = time.monotonic(), None
        runner = root / "music_service/native_runner.py"
        shutil.copyfile(runner, folder / "native_runner_snapshot.py")
        runner_hash = fingerprint(runner)
        try:
            with (folder / "runner.log").open("wb") as log:
                process = subprocess.Popen([str(settings.inference_engine_python.resolve()),
                                            str(root / "music_service/native_runner.py"), str(source), str(result_file)],
                                           stdout=log, stderr=log,
                                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                code = process.wait(timeout=settings.inference_timeout_seconds)
        finally:
            if process is not None and process.poll() is None:
                terminate_owned_tree(process)
        result = json.loads(result_file.read_text(encoding="utf-8")) if result_file.is_file() else {}
        metadata = None
        if code == 0 and result.get("path"):
            shutil.copyfile(result["path"], folder / "song.wav")
            metadata = inspect_audio(folder / "song.wav", seconds)
            if abs(metadata["duration"] - seconds) > .1:
                raise RuntimeError("Full output duration does not match the arrangement")
        source_unchanged = fingerprint(args.source.resolve()) == blueprint["approvedSource"]["sha256"]
        report = {"kind": "approved-b-transition-study" if args.preview else "approved-b-full-song",
                  "exitCode": code, "elapsedSeconds": time.monotonic() - started,
                  "glmCalls": 0, "approvedSourcePreserved": source_unchanged,
                  "nativeAdapterSha256": runner_hash,
                  "conditioning": result.get("conditioning"), "audio": metadata,
                  "errorCode": native_failure_code(code, result) if code != 0 else None, "humanReview": "pending",
                  "defaultWebsiteAudioConditioningChanged": False}
        (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if code != 0 or not metadata or not source_unchanged:
            raise SystemExit("Full-song inference failed; no automatic retry or fake audio fallback.")
    finally:
        if lock:
            lock.close()


if __name__ == "__main__":
    main()
