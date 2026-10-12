import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path

from .audio import inspect_audio
from .producer import Producer
from .processes import terminate_owned_tree
from .schemas import ServiceFailure, SongRequest
from .settings import Settings
from .store import JobStore
from .performance import plan_performance


def native_failure_code(returncode: int, result: dict) -> str:
    # Windows subprocess exit codes may be reported signed or unsigned.
    if returncode & 0xFFFFFFFF == 0xC0000005:
        return "ENGINE_CRASHED"
    return result.get("errorCode", "ENGINE_FAILED")


class Worker:
    def __init__(self, store: JobStore, settings: Settings):
        self.store, self.settings = store, settings
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.run, name="music-worker", daemon=True)

    def run(self):
        while not self.stop.is_set():
            job = self.store.next_queued()
            if job:
                self.execute(job)
            else:
                self.stop.wait(0.3)

    def execute(self, job: dict):
        job_id = job["id"]
        process = None
        try:
            request = SongRequest.model_validate(job["request"])
            plan, producer_run = Producer(self.settings).plan(request)
            self.store.update(job_id, plan=plan.model_dump(), producer=producer_run)
            if self.stop.is_set():
                self.store.update(job_id, status="failed", errorCode="ENGINE_INTERRUPTED", error="推理服务正在关闭，任务已中断。")
                return
            if self.store.get(job_id)["cancelRequested"]:
                self.store.update(job_id, status="cancelled", stage="cancelled")
                return
            if request.mode == "words":
                self.store.finish(job_id, result={"kind": "lyrics", "lyrics": plan.lyrics})
                return
            _, performance = plan_performance(plan.model_dump(), instrumental=request.instrumental)
            self.store.update(job_id, performance=performance)
            if self.settings.engine_issues():
                raise ServiceFailure("MODEL_MISSING", "音乐运行环境或权重尚未准备好，未生成音频。")
            folder = self.settings.inference_data_dir.resolve() / "outputs" / job_id
            folder.mkdir(parents=True, exist_ok=True)
            runner_input, runner_output = folder / "input.json", folder / "result.json"
            payload = {"plan": plan.model_dump(), "request": request.model_dump(),
                       "aceRoot": str(self.settings.inference_ace_root.resolve()),
                       "checkpoints": str(self.settings.inference_checkpoints_dir.resolve()),
                       "model": self.settings.inference_model, "device": self.settings.inference_device,
                       "compositionModel": self.settings.inference_composition_model if self.settings.inference_composition_enabled else "",
                       "compositionStrength": self.settings.inference_composition_strength if self.settings.inference_composition_enabled else 1.0,
                       "servicePid": os.getpid(),
                       "outputDir": str(folder)}
            runner_input.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            self.store.update(job_id, stage="loading")
            with (folder / "runner.log").open("wb") as log:
                process = subprocess.Popen(
                    [str(self.settings.inference_engine_python.resolve()),
                     str(Path(__file__).with_name("native_runner.py")), str(runner_input), str(runner_output)],
                    stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                started = time.monotonic()
                while process.poll() is None:
                    if self.stop.is_set() or self.store.get(job_id)["cancelRequested"]:
                        terminate_owned_tree(process)
                        cancelled = self.store.get(job_id)["cancelRequested"]
                        self.store.update(job_id, status="cancelled" if cancelled else "failed",
                                          stage="cancelled" if cancelled else "interrupted",
                                          errorCode="" if cancelled else "ENGINE_INTERRUPTED")
                        return
                    if time.monotonic() - started > self.settings.inference_timeout_seconds:
                        raise ServiceFailure("ENGINE_TIMEOUT", "完整歌曲生成超时；没有自动重复生成，旧作品仍保留。")
                    if runner_output.with_suffix(".stage").is_file():
                        stage = runner_output.with_suffix(".stage").read_text(encoding="utf-8").strip()
                        if stage in {"loading", "composing", "generating"}:
                            self.store.update(job_id, stage=stage)
                    self.stop.wait(1)
            result = json.loads(runner_output.read_text(encoding="utf-8")) if runner_output.is_file() else {}
            (folder / "runner-exit.json").write_text(json.dumps({"exitCode": process.returncode}), encoding="utf-8")
            if process.returncode != 0 or "path" not in result:
                code = native_failure_code(process.returncode, result)
                raise ServiceFailure(code, "音乐推理失败，请检查本地运行环境与资源；没有生成替代音频。")
            source = Path(result["path"]).resolve()
            if not source.is_relative_to(folder) or not source.is_file():
                raise ServiceFailure("OUTPUT_INVALID", "引擎输出路径无效。")
            self.store.update(job_id, stage="validating")
            asset = folder / "song.wav"
            if source != asset:
                shutil.copyfile(source, asset)
            metadata = inspect_audio(asset, request.seconds)
            self.store.finish(job_id, result={"kind": "audio", "lyrics": plan.lyrics, "model": self.settings.inference_model,
                                             "seed": result.get("seed"), "composition": result.get("composition"),
                                             "performance": result.get("performance"), "audio": metadata})
        except ServiceFailure as exc:
            latest = self.store.get(job_id)
            details = {"producerDiagnostics": exc.diagnostics} if exc.diagnostics else {}
            self.store.update(job_id, status="cancelled" if latest["cancelRequested"] else "failed",
                              errorCode=exc.code, error=exc.message, **details)
        except Exception:
            self.store.update(job_id, status="failed", errorCode="ENGINE_FAILED",
                              error="推理任务发生异常，请检查私有诊断日志；旧作品仍保留。")
        finally:
            if process is not None and process.poll() is None:
                terminate_owned_tree(process)

    def close(self):
        self.stop.set()
        self.thread.join(timeout=self.settings.glm_timeout_seconds * 2 + 20)
