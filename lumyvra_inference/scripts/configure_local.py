"""Create a shared private key without displaying it or changing other settings."""
import re
import secrets
from pathlib import Path

from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
backend = root.parent / "lumyvra_backend" / ".env"
inference = root / ".env"
existing_backend = dotenv_values(backend) if backend.exists() else {}
existing_inference = dotenv_values(inference) if inference.exists() else {}
key = existing_inference.get("INFERENCE_API_KEY") or existing_backend.get("INFERENCE_API_KEY") or secrets.token_urlsafe(40)


def set_value(path: Path, name: str, value: str):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    pattern = rf"(?m)^{re.escape(name)}=.*$"
    line = f"{name}={value}"
    text = re.sub(pattern, lambda _: line, text) if re.search(pattern, text) else text.rstrip() + "\n" + line + "\n"
    path.write_text(text.lstrip("\n"), encoding="utf-8")


set_value(backend, "INFERENCE_API_KEY", key)
set_value(inference, "INFERENCE_API_KEY", key)
set_value(backend, "GENERATION_MODE", "local")
set_value(backend, "INFERENCE_URL", "http://127.0.0.1:8090")
print("Local inference authentication configured. Existing mail, OAuth and GLM settings preserved.")
