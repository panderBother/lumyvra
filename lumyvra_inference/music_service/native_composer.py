"""An isolated music-LM stage: finish and exit before DiT weights are loaded."""
import json
import os
import sys
import threading
import time
from pathlib import Path

if __package__:
    from .composition import composition_fingerprint, validate_audio_codes
    from .native_runner import watch_service
    from .performance import plan_performance
else:
    from composition import composition_fingerprint, validate_audio_codes
    from native_runner import watch_service
    from performance import plan_performance


def main():
    source, output = map(Path, sys.argv[1:3])
    payload = json.loads(source.read_text(encoding="utf-8"))
    threading.Thread(target=watch_service, args=(payload["parentPid"],), daemon=True).start()
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["ACESTEP_CHECKPOINTS_DIR"] = payload["checkpoints"]
    sys.path.insert(0, payload["aceRoot"])
    try:
        import torch
        from transformers import AutoModelForCausalLM

        from acestep.llm_inference import LLMHandler

        torch.set_num_threads(2)
        if payload["device"] == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA_UNAVAILABLE")

        class LocalOnlyLM(LLMHandler):
            def _load_pytorch_model(self, model_path, device):
                # Upstream moves float32 weights to CUDA before casting them.
                # Load directly at the final dtype to avoid that 4GB peak.
                self.llm = AutoModelForCausalLM.from_pretrained(
                    model_path, torch_dtype=self.dtype, local_files_only=True,
                    trust_remote_code=False, attn_implementation="sdpa",
                ).to(device)
                self.llm.eval()
                self.llm_backend, self.llm_initialized = "pt", True
                return True, "Local semantic music model loaded"

        model_folder = Path(payload["checkpoints"]) / payload["compositionModel"]
        if not (model_folder / "config.json").is_file() or not (model_folder / "model.safetensors").is_file():
            raise RuntimeError("MODEL_MISSING")
        started = time.monotonic()
        handler = LocalOnlyLM()
        status, loaded = handler.initialize(payload["checkpoints"], payload["compositionModel"],
                                            backend="pt", device=payload["device"], offload_to_cpu=False)
        if not loaded:
            print(status, file=sys.stderr, flush=True)
            raise RuntimeError("COMPOSITION_FAILED")
        plan, request = payload["plan"], payload["request"]
        singing, performance = plan_performance(plan, instrumental=request["instrumental"])
        torch.manual_seed(request["seed"])
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(request["seed"])
        result = handler.generate_with_stop_condition(
            caption=plan["caption"], lyrics=singing, infer_type="llm_dit",
            target_duration=request["seconds"], temperature=0.85, cfg_scale=2.0, top_p=0.9,
            user_metadata={"bpm": plan["bpm"] or 100, "duration": request["seconds"],
                           "keyscale": plan["key"] or "C major", "timesignature": "4",
                           "language": plan["vocal_language"], "caption": plan["caption"]},
            use_cot_metas=False, use_cot_caption=False, use_cot_language=False,
            use_constrained_decoding=True, batch_size=1,
        )
        if not result.get("success"):
            print(result.get("error", "Composition failed"), file=sys.stderr, flush=True)
            raise RuntimeError("COMPOSITION_FAILED")
        codes = result.get("audio_codes", "")
        count = validate_audio_codes(codes, request["seconds"])
        output.write_text(json.dumps({"audioCodes": codes, "model": payload["compositionModel"],
                                      "codeCount": count, "seed": request["seed"],
                                      "inputFingerprint": composition_fingerprint(plan, request),
                                      "sampling": {"temperature": 0.85, "cfgScale": 2.0, "topP": 0.9},
                                      "performance": performance,
                                      "elapsedSeconds": time.monotonic() - started,
                                      "maxVramBytes": torch.cuda.max_memory_allocated() if torch.cuda.is_available() else 0}),
                          encoding="utf-8")
    except Exception as exc:
        import traceback
        traceback.print_exc()
        code = "OUT_OF_MEMORY" if "out of memory" in str(exc).lower() else (
            str(exc) if str(exc) in {"CUDA_UNAVAILABLE", "MODEL_MISSING"} else "COMPOSITION_FAILED")
        output.write_text(json.dumps({"errorCode": code}), encoding="utf-8")
        sys.exit(1)


if __name__ == "__main__":
    main()
