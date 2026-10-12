"""Read-only hardware/runtime probe; never downloads or generates music."""
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from music_service.settings import Settings  # noqa: E402

settings = Settings()
probe = """
import json, torch, importlib.metadata
print(json.dumps({'torch': torch.__version__, 'torchao': importlib.metadata.version('torchao'), 'cudaRuntime': torch.version.cuda,
 'cudaAvailable': torch.cuda.is_available(),
 'gpu': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
 'vramBytes': torch.cuda.get_device_properties(0).total_memory if torch.cuda.is_available() else None}))
"""
report = {"engineIssues": settings.engine_issues(), "producerConfigured": settings.producer_configured,
          "freeDiskBytes": shutil.disk_usage(root).free, "nativeRuntime": str(settings.inference_engine_python),
          "serviceDependencies": all(importlib.util.find_spec(name) is not None for name in ("fastapi", "soundfile", "httpx"))}
if settings.inference_engine_python.is_file():
    try:
        process = subprocess.run([str(settings.inference_engine_python), "-c", probe],
                                 capture_output=True, text=True, timeout=180)
        report["runtime"] = json.loads(process.stdout.strip().splitlines()[-1]) if process.returncode == 0 else {
            "error": "NATIVE_RUNTIME_UNAVAILABLE", "exitCode": process.returncode}
    except (subprocess.TimeoutExpired, ValueError, IndexError):
        report["runtime"] = {"error": "RUNTIME_PROBE_FAILED"}
print(json.dumps(report, ensure_ascii=False, indent=2))
