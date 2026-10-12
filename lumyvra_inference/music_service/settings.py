from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    inference_api_key: SecretStr = SecretStr("")
    inference_data_dir: Path = Path("data")
    inference_engine_python: Path = Path("vendor/ACE-Step-1.5/.venv/Scripts/python.exe")
    inference_ace_root: Path = Path("vendor/ACE-Step-1.5")
    inference_checkpoints_dir: Path = Path("checkpoints")
    inference_model: str = "acestep-v15-turbo"
    inference_device: str = "cuda"
    inference_composition_enabled: bool = False
    inference_composition_model: str = "acestep-5Hz-lm-0.6B"
    # Keep the prior production setting until a comparison has listening approval.
    inference_composition_strength: float = Field(default=1.0, ge=0.25, le=1.0, allow_inf_nan=False)
    inference_songwriting_profile: Literal["balanced", "mandarin_melodic", "mandarin_electro"] = "balanced"
    inference_max_seconds: int = Field(default=240, ge=30, le=600)
    inference_timeout_seconds: int = Field(default=3600, ge=60, le=14400)
    glm_base_url: str = ""
    glm_api_key: SecretStr = SecretStr("")
    glm_model: str = "GLM-5.3-Flash"
    glm_timeout_seconds: int = Field(default=180, ge=30, le=600)

    @property
    def producer_configured(self) -> bool:
        return bool(self.glm_base_url and self.glm_api_key.get_secret_value())

    def engine_issues(self) -> list[str]:
        issues = []
        if not self.inference_engine_python.is_file():
            issues.append("ENGINE_RUNTIME_MISSING")
        if not (self.inference_ace_root / "acestep" / "inference.py").is_file():
            issues.append("ENGINE_SOURCE_MISSING")
        for component in (self.inference_model, "vae", "Qwen3-Embedding-0.6B"):
            folder = self.inference_checkpoints_dir / component
            if not folder.is_dir() or not any(folder.rglob("*.safetensors")):
                issues.append("MODEL_MISSING")
                break
        if self.inference_composition_enabled:
            folder = self.inference_checkpoints_dir / self.inference_composition_model
            if not (folder / "config.json").is_file() or not (folder / "model.safetensors").is_file():
                issues.append("COMPOSITION_MODEL_MISSING")
        return issues
