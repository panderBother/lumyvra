"""Render original hooks and optionally test private source-audio conditioning.

No GLM calls, downloads, copied songs or public publication. Stop the idle private
inference service first before --run; its exclusive lock prevents overlapping GPU jobs.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.audio import inspect_audio  # noqa: E402
from music_service.melody_sketch import BPM, LYRICS, render_sketch  # noqa: E402
from music_service.processes import terminate_owned_tree  # noqa: E402
from music_service.settings import Settings  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true", help="Actually run ACE; otherwise render only instrumental sketches.")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    settings = Settings()
    folder = args.output or settings.inference_data_dir / "evaluation" / ("reference-hooks-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    folder = folder.resolve()
    folder.mkdir(parents=True, exist_ok=True)
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
        reports = []
        for variant in ("a", "b"):
            output_dir = folder / variant
            blueprint = render_sketch(output_dir, variant)
            caption = (f"Mandarin pop R&B, {BPM} BPM, female lead singing the supplied lyrics. "
                       "Forward syncopated electric bass, crisp kick and rimshot, Rhodes chords. "
                       "Start with the chorus; repeat its short vocal motif with an answering phrase. "
                       "Natural rhythmic diction and breathing spaces. Turn the instrumental guide melody into sung phrases, "
                       "not a synth solo. Two chorus passes, short resolving ending.")
            payload = {"request": {"seed": 20261011, "seconds": 36, "instrumental": False},
                       "plan": {"title": "先别说晚安", "caption": caption, "lyrics": LYRICS,
                                "bpm": BPM, "key": "C major", "vocal_language": "zh"},
                       "aceRoot": str(settings.inference_ace_root.resolve()),
                       "checkpoints": str(settings.inference_checkpoints_dir.resolve()),
                       "model": settings.inference_model, "device": settings.inference_device,
                       "compositionModel": "", "melodyGuide": str(output_dir / "guide.wav"),
                       "audioCoverStrength": .65, "servicePid": os.getpid(), "outputDir": str(output_dir)}
            source, result_file = output_dir / "input.json", output_dir / "result.json"
            source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            print(json.dumps({"variant": variant, "folder": str(output_dir), "mode": "actual-inference" if args.run else "instrumental-sketch-only"}), flush=True)
            if not args.run:
                continue
            started = time.monotonic()
            process = None
            try:
                with (output_dir / "runner.log").open("wb") as log:
                    process = subprocess.Popen([str(settings.inference_engine_python.resolve()),
                                                str(root / "music_service/native_runner.py"), str(source), str(result_file)],
                                               stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                    code = process.wait(timeout=settings.inference_timeout_seconds)
            finally:
                if process is not None and process.poll() is None:
                    terminate_owned_tree(process)
            result = json.loads(result_file.read_text(encoding="utf-8")) if result_file.is_file() else {}
            if code == 0 and result.get("path"):
                import shutil
                shutil.copyfile(result["path"], output_dir / "song.wav")
            report = {"variant": variant, "exitCode": code, "elapsedSeconds": time.monotonic() - started,
                      "glmCalls": 0, "conditioning": result.get("conditioning"),
                      "audio": inspect_audio(output_dir / "song.wav", 36) if result.get("path") and code == 0 else None,
                      "errorCode": result.get("errorCode"), "humanReview": "pending", "blueprint": blueprint}
            (output_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            reports.append({key: value for key, value in report.items() if key != "blueprint"})
            print(json.dumps(reports[-1], ensure_ascii=False), flush=True)
            if code != 0:
                raise SystemExit("Native probe failed; no automatic retry or alternative model.")
        (folder / "report.json").write_text(json.dumps({"kind": "diagnostic-hook-comparison", "defaultWebsiteAudioConditioningChanged": False,
                                                      "humanReview": "pending", "variants": reports}, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        if lock:
            lock.close()


if __name__ == "__main__":
    main()
