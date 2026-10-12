import hashlib
from pathlib import Path

import numpy as np
import soundfile as sf

from .schemas import ServiceFailure


def inspect_audio(path: Path, target_seconds: int) -> dict:
    try:
        info = sf.info(path)
        if info.frames <= 0 or info.samplerate < 16000 or info.channels not in (1, 2):
            raise ValueError("invalid format")
        if not target_seconds * 0.75 <= info.duration <= target_seconds * 1.25:
            raise ValueError("unexpected duration")
        peak, total_square, samples, active = 0.0, 0.0, 0, 0
        # Stream in blocks: do not allocate the whole song just to inspect it.
        with sf.SoundFile(path) as source:
            for block in source.blocks(blocksize=65536, dtype="float32", always_2d=True):
                if not np.isfinite(block).all():
                    raise ValueError("non-finite audio")
                peak = max(peak, float(np.abs(block).max()))
                total_square += float(np.square(block.astype(np.float64)).sum())
                samples += block.size
                active += int(np.count_nonzero(np.abs(block) > 0.001))
        rms = float(np.sqrt(total_square / max(samples, 1)))
        if rms < 0.0001 or active / max(samples, 1) < 0.005:
            raise ValueError("silent audio")
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        return {"duration": info.duration, "sampleRate": info.samplerate, "channels": info.channels,
                "bytes": path.stat().st_size, "sha256": digest.hexdigest(), "peak": peak, "rms": rms,
                "reviewStatus": "unreviewed", "warnings": ["PEAK_HIGH"] if peak >= 0.999 else []}
    except (OSError, RuntimeError, ValueError) as exc:
        raise ServiceFailure("OUTPUT_INVALID", "生成音频为空、损坏、明显静音或时长不符合请求；未登记成功作品。") from exc
