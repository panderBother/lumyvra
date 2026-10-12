import hashlib
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from .schemas import ServiceFailure, SongRequest


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobStore:
    def __init__(self, folder: Path):
        folder.mkdir(parents=True, exist_ok=True)
        self.path = folder / "jobs.sqlite3"
        self.lock = threading.RLock()
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, data TEXT NOT NULL)")

    def connect(self):
        return sqlite3.connect(self.path, timeout=10)

    def get(self, job_id: str) -> dict | None:
        with self.lock, self.connect() as db:
            row = db.execute("SELECT data FROM jobs WHERE id=?", (job_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def create(self, request: SongRequest) -> dict:
        raw = request.model_dump()
        fingerprint = hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()
        with self.lock, self.connect() as db:
            row = db.execute("SELECT fingerprint,data FROM jobs WHERE id=?", (request.id,)).fetchone()
            if row:
                if row[0] != fingerprint:
                    raise ServiceFailure("IDEMPOTENCY_CONFLICT", "任务编号已被不同输入使用。")
                return json.loads(row[1])
            active = sum(json.loads(row[0])["status"] in ("queued", "running", "cancelling")
                         for row in db.execute("SELECT data FROM jobs"))
            if active >= 6:
                raise ServiceFailure("QUEUE_FULL", "音乐推理队列已满，请稍后再试。")
            job = {"id": request.id, "status": "queued", "stage": "queued", "request": raw,
                   "createdAt": timestamp(), "updatedAt": timestamp(), "cancelRequested": False}
            db.execute("INSERT INTO jobs VALUES(?,?,?)", (request.id, fingerprint, json.dumps(job)))
            return job

    def update(self, job_id: str, **fields) -> dict:
        with self.lock, self.connect() as db:
            row = db.execute("SELECT data FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                raise KeyError(job_id)
            job = json.loads(row[0])
            if job["status"] in ("succeeded", "failed", "cancelled"):
                return job
            job.update(fields, updatedAt=timestamp())
            db.execute("UPDATE jobs SET data=? WHERE id=?", (json.dumps(job), job_id))
            return job

    def next_queued(self) -> dict | None:
        with self.lock, self.connect() as db:
            for row in db.execute("SELECT data FROM jobs ORDER BY rowid"):
                job = json.loads(row[0])
                if job["status"] == "queued":
                    return self.update(job["id"], status="running", stage="planning")
        return None

    def recover(self):
        with self.lock, self.connect() as db:
            jobs = [json.loads(row[0]) for row in db.execute("SELECT data FROM jobs")]
            for job in jobs:
                if job["status"] in ("running", "cancelling"):
                    self.update(job["id"], status="cancelled" if job["cancelRequested"] else "failed",
                                errorCode="ENGINE_INTERRUPTED", error="推理服务重启中断了任务，旧作品仍保留。")

    def cancel(self, job_id: str) -> dict:
        with self.lock:
            job = self.get(job_id)
            if not job:
                raise KeyError(job_id)
            if job["status"] in ("queued", "running", "cancelling"):
                return self.update(job_id, cancelRequested=True,
                                   status="cancelled" if job["status"] == "queued" else "cancelling",
                                   stage="cancelling")
            return job

    def finish(self, job_id: str, **fields) -> dict:
        with self.lock:
            job = self.get(job_id)
            if job["cancelRequested"]:
                return self.update(job_id, status="cancelled", stage="cancelled")
            return self.update(job_id, status="succeeded", stage="completed", **fields)
