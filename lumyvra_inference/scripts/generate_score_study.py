"""One bounded local inference from a new original score; no GLM or downloads.

The website's idle inference service must be stopped before --run. Uses its GPU
lock and keeps every prior candidate. The guide is never delivered as a song.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.audio import inspect_audio  # noqa: E402
from music_service.hook_song import fingerprint  # noqa: E402
from music_service.original_score import render_score  # noqa: E402
from music_service.mandarin_melodic_score import render_mandarin_score  # noqa: E402
from music_service.processes import terminate_owned_tree  # noqa: E402
from music_service.schemas import ProductionPlan  # noqa: E402
from music_service.settings import Settings  # noqa: E402
from music_service.worker import native_failure_code  # noqa: E402

CAPTIONS = {
    "mandarin": "Melody-led Mandarin pop ballad, 80 BPM, A minor, clear natural single male lead. "
                "Warm piano, clean guitar, electric bass and restrained drums. Conversational low verse; "
                "pre-chorus gathers tension then breathes. Connected chorus phrases with recurring opening "
                "motif, one melodic peak on a key word, held endings and a resolving answer. Fuller chorus "
                "drums, restrained vocal runs. Sing the supplied lyrics using the guide melody, replace "
                "the guide lead tone with vocals. Resolving outro.",
    "pop": "Mandarin dance-pop, 112 BPM, C major, clear single female lead. Bouncy electric bass, "
           "offbeat guitar and keys, crisp drums. Sparse conversational verse; pre-chorus builds then "
           "a one-beat stop. Chorus opens on a firm four-beat groove: repeated three-syllable hook, "
           "longer melodic answer, sustained keywords. Short instrumental answers in vocal rests. "
           "Sing the supplied lyrics using the guide melody, replacing the guide lead tone with vocals. "
           "Minimal runs, resolving outro.",
    "rnb": "Mandarin pop-R&B, 112 BPM, C major, clear single male lead. Interlocking syncopated kick "
           "and bass, crisp rimshot, spacious Rhodes. Conversational verse with rests; rising pre-chorus "
           "then a one-beat stop. Chorus repeats a three-syllable motif with a longer answering phrase, "
           "sustained keywords and fuller bass. Instrumental answers only in vocal gaps. Sing the supplied "
           "lyrics using the guide melody, replacing the guide lead tone with vocals. Few runs, resolving outro.",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=tuple(CAPTIONS), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cover-strength", type=float, default=.55)
    parser.add_argument("--seed", type=int, default=20261011)
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    if not math.isfinite(args.cover_strength) or not 0 < args.cover_strength <= 1:
        parser.error("cover-strength must be finite and in (0, 1]")
    config = Settings()
    folder = args.output.resolve()
    if not folder.is_relative_to((root / "data/evaluation").resolve()):
        parser.error("Output must be a new directory inside data/evaluation")
    if args.run and config.engine_issues():
        raise SystemExit("Configured local engine is incomplete; no download or fallback performed.")
    lock = None
    try:
        if args.run:
            lock = (config.inference_data_dir / "service.lock").open("r+b")
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        blueprint = render_mandarin_score(folder) if args.variant == "mandarin" else render_score(folder, args.variant)
        plan = ProductionPlan(title=blueprint["title"], lyrics=blueprint["lyrics"],
                              caption=CAPTIONS[args.variant], bpm=blueprint["bpm"], key=blueprint["key"],
                              vocal_language="zh")
        guide_hash = fingerprint(folder / "guide.wav")
        payload = {"request": {"seed": args.seed, "seconds": blueprint["seconds"], "instrumental": False},
                   "plan": plan.model_dump(), "aceRoot": str(config.inference_ace_root.resolve()),
                   "checkpoints": str(config.inference_checkpoints_dir.resolve()),
                   "model": config.inference_model, "device": config.inference_device,
                   "compositionModel": "", "melodyGuide": str(folder / "guide.wav"),
                   "audioCoverStrength": args.cover_strength, "servicePid": os.getpid(), "outputDir": str(folder)}
        source, result_file = folder / "input.json", folder / "result.json"
        source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"variant": args.variant, "folder": str(folder), "seconds": blueprint["seconds"],
                          "glmCalls": 0, "run": args.run}), flush=True)
        if not args.run:
            return
        started, process = time.monotonic(), None
        runner = root / "music_service/native_runner.py"
        shutil.copyfile(runner, folder / "native_runner_snapshot.py")
        try:
            with (folder / "runner.log").open("wb") as log:
                process = subprocess.Popen([str(config.inference_engine_python.resolve()), str(runner),
                                            str(source), str(result_file)], stdout=log, stderr=log,
                                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                code = process.wait(timeout=config.inference_timeout_seconds)
        finally:
            if process is not None and process.poll() is None:
                terminate_owned_tree(process)
        result = json.loads(result_file.read_text(encoding="utf-8")) if result_file.is_file() else {}
        metadata = None
        if code == 0 and result.get("path"):
            asset = Path(result["path"]).resolve()
            if not asset.is_relative_to(folder) or asset == folder / "guide.wav":
                raise ValueError("Invalid model output: never deliver the guide as a generated song")
            shutil.copyfile(asset, folder / "song.wav")
            metadata = inspect_audio(folder / "song.wav", blueprint["seconds"])
            if abs(metadata["duration"] - blueprint["seconds"]) > .1 or metadata["sha256"] == guide_hash:
                raise ValueError("Output duration or provenance check failed")
        report = {"kind": "original-score-model-study", "variant": args.variant, "exitCode": code,
                  "elapsedSeconds": time.monotonic() - started, "glmCalls": 0,
                  "nativeAdapterSha256": fingerprint(folder / "native_runner_snapshot.py"),
                  "guideSha256": guide_hash, "guidePreserved": fingerprint(folder / "guide.wav") == guide_hash,
                  "conditioning": result.get("conditioning"), "audio": metadata, "humanReview": "pending",
                  "errorCode": native_failure_code(code, result) if code != 0 else None,
                  "websiteNoteConditioningChanged": False,
                  "limits": "New original notes, groove and singer differ together. Technical checks do not prove musical quality."}
        (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if code != 0 or not metadata or not report["guidePreserved"]:
            raise SystemExit("Inference failed; no retry or substitute synthesized song.")
    finally:
        if lock:
            lock.close()


if __name__ == "__main__":
    main()
