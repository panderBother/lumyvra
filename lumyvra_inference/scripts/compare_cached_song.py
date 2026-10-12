"""One local, cached-plan diagnostic candidate; no GLM calls or model downloads.

--run requires the idle API stopped first and holds its exclusive GPU lock.
Use an explicit reviewed plan JSON; never mutate the old job or published audio.
"""
import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from music_service.audio import inspect_audio  # noqa: E402
from music_service.performance import plan_performance  # noqa: E402
from music_service.processes import terminate_owned_tree  # noqa: E402
from music_service.schemas import ProductionPlan  # noqa: E402
from music_service.settings import Settings  # noqa: E402
from music_service.worker import native_failure_code  # noqa: E402


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--composition", choices=("configured", "none"), default="configured",
                        help="Explicit diagnostic ablation only; never a failure fallback.")
    args = parser.parse_args()
    config = Settings()
    with sqlite3.connect("file:" + str(root / "data/jobs.sqlite3") + "?mode=ro", uri=True) as db:
        row = db.execute("SELECT data FROM jobs WHERE id = ?", (args.job,)).fetchone()
    if not row:
        raise ValueError("Unknown source job")
    job = json.loads(row[0])
    original = root / "data/outputs" / args.job / "song.wav"
    before = digest(original)
    plan = ProductionPlan.model_validate_json(args.plan.read_text(encoding="utf-8"))
    if plan.lyrics != job["plan"]["lyrics"]:
        raise ValueError("Comparison candidate must keep saved source lyrics exactly")
    singing, performance = plan_performance(plan.model_dump(), instrumental=job["request"]["instrumental"])
    folder = args.output.resolve()
    if not folder.is_relative_to((root / "data/evaluation").resolve()):
        raise ValueError("Diagnostic output must stay inside data/evaluation")
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
        folder.mkdir(parents=True, exist_ok=False)
        request = dict(job["request"], seed=job["result"]["seed"])
        payload = {"plan": plan.model_dump(), "request": request,
                   "aceRoot": str(config.inference_ace_root.resolve()),
                   "checkpoints": str(config.inference_checkpoints_dir.resolve()),
                   "model": config.inference_model, "device": config.inference_device,
                   "compositionModel": config.inference_composition_model if args.composition == "configured" else "",
                   "servicePid": os.getpid(), "outputDir": str(folder)}
        source, result_file = folder / "input.json", folder / "result.json"
        source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        (folder / "singing-layout.txt").write_text(singing, encoding="utf-8")
        print(json.dumps({"kind": "cached-plan-comparison", "seconds": request["seconds"],
                          "seed": request["seed"], "composition": args.composition,
                          "glmCalls": 0, "run": args.run}), flush=True)
        if not args.run:
            return
        process, started = None, time.monotonic()
        try:
            with (folder / "runner.log").open("wb") as log:
                process = subprocess.Popen([str(config.inference_engine_python.resolve()),
                                            str(root / "music_service/native_runner.py"), str(source), str(result_file)],
                                           stdout=log, stderr=log,
                                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                code = process.wait(timeout=config.inference_timeout_seconds)
        finally:
            if process is not None and process.poll() is None:
                terminate_owned_tree(process)
        result = json.loads(result_file.read_text(encoding="utf-8")) if result_file.is_file() else {}
        metadata = None
        if code == 0 and result.get("path"):
            asset = Path(result["path"]).resolve()
            if not asset.is_relative_to(folder):
                raise ValueError("Invalid runner asset path")
            shutil.copyfile(asset, folder / "song.wav")
            metadata = inspect_audio(folder / "song.wav", request["seconds"])
        report = {"kind": "cached-plan-comparison", "exitCode": code,
                  "elapsedSeconds": time.monotonic() - started, "glmCalls": 0,
                  "seed": request["seed"], "sourceAudioPreserved": before == digest(original),
                  "sourceLyricsPreserved": plan.lyrics == job["plan"]["lyrics"],
                  "audio": metadata, "performance": performance,
                  "composition": result.get("composition"), "humanReview": "pending",
                  "compositionMode": args.composition,
                  "errorCode": native_failure_code(code, result) if code != 0 else None,
                  "comparisonLimits": "Same seed, lyrics and duration; caption, tempo and section layout change together. Not an isolated ablation."}
        (folder / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if code != 0 or not metadata or not report["sourceAudioPreserved"]:
            raise SystemExit("Candidate failed; no automatic retry or fake replacement audio.")
    finally:
        if lock:
            lock.close()


if __name__ == "__main__":
    main()
