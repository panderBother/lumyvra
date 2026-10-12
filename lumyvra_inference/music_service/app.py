import os
import secrets
import shutil
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from .schemas import ServiceFailure, SongRequest
from .settings import Settings
from .store import JobStore
from .worker import Worker


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    store = JobStore(settings.inference_data_dir)
    worker = Worker(store, settings)

    @asynccontextmanager
    async def lifespan(app):
        # Exclusive process lock prevents two HTTP processes using the same GPU queue.
        lock = (settings.inference_data_dir / "service.lock").open("a+b")
        lock.seek(0)
        lock.write(b"1")
        lock.flush()
        lock.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            store.recover()
            worker.thread.start()
            yield
        finally:
            worker.close()
            lock.close()

    app = FastAPI(title="Lumyvra private inference", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.store = store

    def authorize(authorization: str = Header(default="")):
        key = settings.inference_api_key.get_secret_value()
        if not key or not secrets.compare_digest(authorization, "Bearer " + key):
            raise HTTPException(401, "Private inference authentication required")

    @app.exception_handler(ServiceFailure)
    async def service_failure(request, exc: ServiceFailure):
        status = 409 if exc.code == "IDEMPOTENCY_CONFLICT" else 503
        return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=status)

    @app.get("/health", dependencies=[Depends(authorize)])
    def health():
        issues = settings.engine_issues()
        return {"status": "configured" if not issues else "unconfigured", "available": not issues,
                "issues": issues, "provider": "ace-step", "model": settings.inference_model,
                "producerAvailable": settings.producer_configured, "minSeconds": 30,
                "compositionEnabled": settings.inference_composition_enabled,
                "maxSeconds": settings.inference_max_seconds, "qualityVerified": False}

    @app.post("/v1/jobs", dependencies=[Depends(authorize)], status_code=202)
    def create_job(song: SongRequest):
        if song.seconds > settings.inference_max_seconds:
            raise ServiceFailure("UNSUPPORTED_DURATION", "当前配置未开放这个时长。")
        # Resolve persisted IDs before checking current availability: restart-safe idempotency.
        existing = store.get(song.id)
        if not existing:
            if shutil.disk_usage(settings.inference_data_dir).free < 1024**3:
                raise ServiceFailure("DISK_FULL", "推理目录可用空间不足，未清理或覆盖已有音频。")
            if song.mode != "words" and settings.engine_issues():
                raise ServiceFailure("MODEL_MISSING", "音乐模型尚未就绪，请先准备运行环境与权重。")
            if song.mode != "lyrics" and not song.instrumental and not settings.producer_configured:
                raise ServiceFailure("GLM_UNAVAILABLE", "歌词助手未配置，请先使用手写歌词。")
        return store.create(song)

    @app.get("/v1/jobs/{job_id}", dependencies=[Depends(authorize)])
    def get_job(job_id: str):
        job = store.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        return {key: value for key, value in job.items() if key not in ("request",)}

    @app.post("/v1/jobs/{job_id}/cancel", dependencies=[Depends(authorize)])
    def cancel_job(job_id: str):
        try:
            return store.cancel(job_id)
        except KeyError as exc:
            raise HTTPException(404, "Job not found") from exc

    @app.get("/v1/jobs/{job_id}/audio", dependencies=[Depends(authorize)])
    def get_audio(job_id: str):
        job = store.get(job_id)
        if not job or job["status"] != "succeeded" or job.get("result", {}).get("kind") != "audio":
            raise HTTPException(404, "Audio not found")
        path = settings.inference_data_dir.resolve() / "outputs" / job["id"] / "song.wav"
        if not path.is_file():
            raise HTTPException(404, "Audio missing")
        return FileResponse(path, media_type="audio/wav", filename="song.wav")

    return app
