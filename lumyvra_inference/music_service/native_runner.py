"""One isolated GPU process per job: cancellable without terminating the HTTP service."""
import json
import math
import os
import secrets
import subprocess
import sys
import threading
from contextlib import contextmanager
from pathlib import Path


def resolve_melody_guide(payload):
    """Only private diagnostic payloads can supply a local original audio guide."""
    if not payload.get("melodyGuide"):
        if payload.get("approvedReference"):
            raise ValueError("An approved reference requires a melody guide")
        return None
    if payload.get("compositionModel"):
        raise ValueError("Choose music codes or a melody guide, not both")
    folder = Path(payload["outputDir"]).resolve()
    guide = Path(payload["melodyGuide"]).resolve()
    if not guide.is_relative_to(folder) or not guide.is_file():
        raise ValueError("Melody guide must exist inside this diagnostic output directory")
    strength = payload.get("audioCoverStrength", 0.65)
    if isinstance(strength, bool) or not isinstance(strength, (int, float)) or not math.isfinite(strength) or not 0 < strength <= 1:
        raise ValueError("Invalid melody guide strength")
    import soundfile as sf
    info = sf.info(guide)
    if info.samplerate != 48000 or info.channels != 2 or abs(info.duration - payload["request"]["seconds"]) > 0.02:
        raise ValueError("Melody guide must match the requested duration, 48kHz stereo")
    reference = None
    if payload.get("approvedReference"):
        reference = Path(payload["approvedReference"]).resolve()
        if not reference.is_relative_to(folder) or not reference.is_file():
            raise ValueError("Approved reference must exist inside this diagnostic output directory")
        reference_info = sf.info(reference)
        if reference_info.samplerate != 48000 or reference_info.channels != 2 or not 1 <= reference_info.duration <= 60:
            raise ValueError("Approved reference must be 1-60 seconds of 48kHz stereo")
    return {"path": str(guide), "strength": strength, "reference": str(reference) if reference else None}


def prepare_unquantized_cpu_dtype(handler):
    """Cast plain CPU weights before the pinned fallback transfers them to CUDA.

    The upstream recursive transfer moves plain parameters to CUDA before its
    dtype conversion. Music-code decoding already casts its components, but
    source-audio tasks do not. Do not touch torchao's quantized tensor storage.
    """
    for module in handler.model.modules():
        for param in module._parameters.values():
            if param is not None and param.device.type == "cpu" and param.is_floating_point() and not handler._is_quantized_tensor(param):
                if param.dtype != handler.dtype:
                    param.data = param.data.to(dtype=handler.dtype)
        for name, buffer in module._buffers.items():
            if buffer is not None and buffer.device.type == "cpu" and buffer.is_floating_point() and not handler._is_quantized_tensor(buffer):
                if buffer.dtype != handler.dtype:
                    module._buffers[name] = buffer.to(dtype=handler.dtype)


@contextmanager
def single_use_diffusion(handler):
    """Release DiT weights after this runner's only diffusion pass.

    The pinned ACE text2music and cover flows decode latents with a separate VAE and
    never reads DiT weights again. Avoid copying torchao tensor subclasses
    back to CPU: that transfer has caused native access violations on Windows.
    This adapter must only be used by the isolated, single-generation runner.
    """
    model = handler.model
    if model is None:
        raise RuntimeError("Diffusion model was already consumed")
    handler._recursive_to_device(model, handler.device, handler.dtype)
    if hasattr(handler, "silence_latent"):
        handler.silence_latent = handler.silence_latent.to(handler.device).to(handler.dtype)
    handler._release_system_memory()
    try:
        yield
    finally:
        # Wait for kernels before releasing their weight storage. Clear the
        # modules as well: ACE's caller can still hold a local model reference.
        handler._synchronize()
        handler.model = None
        for module in model.modules():
            module._parameters.clear()
            module._buffers.clear()
        del model
        handler._release_system_memory()


@contextmanager
def staged_reference_diffusion(handler):
    """Compute cover conditions on CPU before loading the quantized decoder.

    The pinned turbo cover flow completes every prepare_condition call before
    its first decoder forward. The unquantized encoder/tokenizer/detokenizer
    stay on CPU in their existing dtype. Only enable this adapter for the
    isolated approved-reference experiment, never a reusable handler.
    """
    import inspect

    import torch

    model = handler.model
    if model is None:
        raise RuntimeError("Diffusion model was already consumed")
    components = [model.encoder, model.tokenizer, model.detokenizer]
    original_prepare = model.prepare_condition
    signature = inspect.signature(original_prepare)
    cache = []
    decoder_started = False
    hook = None

    def transfer(value, device, dtype):
        if isinstance(value, torch.Tensor):
            return value.to(device=device, dtype=dtype if value.is_floating_point() else value.dtype)
        if isinstance(value, tuple):
            return tuple(transfer(item, device, dtype) for item in value)
        if isinstance(value, list):
            return [transfer(item, device, dtype) for item in value]
        if isinstance(value, dict):
            return {key: transfer(item, device, dtype) for key, item in value.items()}
        return value

    def equivalent(left, right):
        if isinstance(left, torch.Tensor) and isinstance(right, torch.Tensor):
            return left.dtype == right.dtype and left.shape == right.shape and torch.equal(left, right)
        if type(left) is not type(right):
            return False
        if isinstance(left, dict):
            return left.keys() == right.keys() and all(equivalent(left[key], right[key]) for key in left)
        if isinstance(left, (list, tuple)):
            return len(left) == len(right) and all(equivalent(a, b) for a, b in zip(left, right))
        return left == right

    def clone(value):
        if isinstance(value, torch.Tensor):
            return value.clone()
        if isinstance(value, tuple):
            return tuple(clone(item) for item in value)
        if isinstance(value, list):
            return [clone(item) for item in value]
        if isinstance(value, dict):
            return {key: clone(item) for key, item in value.items()}
        return value

    def prepare(*args, **kwargs):
        if decoder_started:
            raise RuntimeError("Conditioning after diffusion is unsupported by the single-use adapter")
        bound = signature.bind(*args, **kwargs)
        bound.apply_defaults()
        arguments = transfer(dict(bound.arguments), "cpu", handler.dtype)
        for previous, output in cache:
            if equivalent(arguments, previous):
                print("Reusing identical approved-reference conditions", flush=True)
                return clone(output)
        print("Computing approved-reference conditions on CPU", flush=True)
        result = transfer(original_prepare(**arguments), handler.device, handler.dtype)
        cache.append((arguments, result))
        if len(cache) > 2:
            cache.pop(0)
        return clone(result)

    def begin_decoder(module, inputs):
        nonlocal decoder_started
        if decoder_started:
            return
        handler._synchronize()
        cache.clear()
        # Conditions are complete. Release their CPU weights before CUDA loads
        # the decoder, reducing system-memory pressure as well as GPU use.
        for component in components:
            for child in component.modules():
                child._parameters.clear()
                child._buffers.clear()
        handler._release_system_memory()
        print("CPU conditioning complete; loading quantized decoder", flush=True)
        handler._recursive_to_device(module, handler.device, handler.dtype)
        handler._release_system_memory()
        decoder_started = True
        print("Approved-reference decoder loaded for diffusion", flush=True)

    try:
        prepare_unquantized_cpu_dtype(handler)
        for component in components:
            for child in component.modules():
                for param in child._parameters.values():
                    if param is not None and param.device.type != "cpu":
                        raise RuntimeError("Expected CPU-offloaded conditioning components")
        # The root's null condition embedding is small and may be used by CFG.
        for param in model._parameters.values():
            if param is not None:
                param.data = param.data.to(handler.device).to(handler.dtype)
        if hasattr(handler, "silence_latent"):
            handler.silence_latent = handler.silence_latent.to(handler.device).to(handler.dtype)
        model.prepare_condition = prepare
        hook = model.decoder.register_forward_pre_hook(begin_decoder)
        handler._release_system_memory()
        yield
    finally:
        if hook is not None:
            hook.remove()
        model.prepare_condition = original_prepare
        handler._synchronize()
        handler.model = None
        for module in model.modules():
            module._parameters.clear()
            module._buffers.clear()
        handler._release_system_memory()


@contextmanager
def semantic_decoder_components(handler):
    """Decode music codes without loading or consuming the entire DiT.

    The pinned quantization filter excludes these two components. They can
    safely return to CPU while the quantized diffusion weights stay intact.
    """
    components = [handler.model.tokenizer.quantizer, handler.model.detokenizer]
    try:
        for component in components:
            handler._recursive_to_device(component, handler.device, handler.dtype)
        yield
    finally:
        handler._synchronize()
        for component in components:
            handler._recursive_to_device(component, "cpu")
        handler._release_system_memory()


def require_local_models(checkpoint_path: Path, config_path: str, vae_variant: str | None = None):
    """Request handling never downloads models, including the unused ACE language model."""
    vae_folder = "vae" if vae_variant in (None, "official") else vae_variant
    components = (config_path, vae_folder, "Qwen3-Embedding-0.6B")
    for component in components:
        folder = checkpoint_path / component
        if not (folder / "config.json").is_file() or not any(folder.glob("*.safetensors")):
            return "ERROR: MODEL_MISSING; run the explicit model preparation command.", False
    return None


def watch_service(service_pid: int):
    """Exit this runner if its HTTP service crashes, so a restart cannot orphan GPU work."""
    if os.name == "nt":
        import ctypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        kernel.WaitForSingleObject.restype = ctypes.c_ulong
        handle = kernel.OpenProcess(0x00100000, False, service_pid)  # SYNCHRONIZE only
        if not handle or kernel.WaitForSingleObject(handle, 0xFFFFFFFF) == 0:
            os._exit(1)
    else:
        import time
        while True:
            try:
                os.kill(service_pid, 0)
            except ProcessLookupError:
                os._exit(1)
            time.sleep(2)


def main():
    import faulthandler
    faulthandler.enable()
    input_path, output_path = map(Path, sys.argv[1:3])
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if payload.get("servicePid"):
        threading.Thread(target=watch_service, args=(payload["servicePid"],), daemon=True).start()
    os.environ["ACESTEP_CHECKPOINTS_DIR"] = payload["checkpoints"]
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["ACESTEP_INIT_LLM"] = "false"
    sys.path.insert(0, payload["aceRoot"])
    try:
        melody_guide = resolve_melody_guide(payload)
        if melody_guide and melody_guide["reference"]:
            # The pinned upstream's 600s default includes CPU conditioning.
            # The diagnostic's outer process deadline remains bounded too.
            os.environ["ACESTEP_GENERATION_TIMEOUT"] = "1200"
        if payload["request"]["seed"] is None:
            payload["request"]["seed"] = secrets.randbelow(2147483648)
        if __package__:
            from .composition import code_condition_strength, read_cached_composition, validate_audio_codes
        else:
            from composition import code_condition_strength, read_cached_composition, validate_audio_codes
        try:
            composition_strength = code_condition_strength(payload)
            composition = read_cached_composition(payload)
        except (ValueError, OSError, KeyError) as exc:
            raise RuntimeError("COMPOSITION_FAILED") from exc
        if payload.get("compositionModel"):
            composition_input = output_path.with_name("composition-input.json")
            composition_output = output_path.with_name("composition.json")
            composition_input.write_text(json.dumps(dict(payload, parentPid=os.getpid()), ensure_ascii=False), encoding="utf-8")
            output_path.with_suffix(".stage").write_text("composing", encoding="utf-8")
            child = subprocess.Popen([sys.executable, str(Path(__file__).with_name("native_composer.py")),
                                      str(composition_input), str(composition_output)],
                                     creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            code = child.wait()
            composition = json.loads(composition_output.read_text(encoding="utf-8")) if composition_output.is_file() else {}
            if code & 0xFFFFFFFF == 0xC0000005:
                raise RuntimeError("ENGINE_CRASHED")
            if code != 0 or "audioCodes" not in composition:
                raise RuntimeError(composition.get("errorCode", "COMPOSITION_FAILED"))
            try:
                validate_audio_codes(composition["audioCodes"], payload["request"]["seconds"])
            except ValueError as exc:
                raise RuntimeError("COMPOSITION_FAILED") from exc
            output_path.with_suffix(".stage").write_text("loading", encoding="utf-8")
        import torch
        # Keep CPU offload work bounded on a laptop while the website stays responsive.
        torch.set_num_threads(2)
        from acestep.constants import TASK_INSTRUCTIONS
        from acestep.handler import AceStepHandler
        from acestep.inference import GenerationConfig, GenerationParams, generate_music

        if payload["device"] == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA_UNAVAILABLE")
        class LocalOnlyHandler(AceStepHandler):
            def _ensure_models_present(self, *, checkpoint_path, config_path, prefer_source, vae_variant=None):
                return require_local_models(checkpoint_path, config_path, vae_variant)

            def tiled_encode(self, audio, chunk_size=None, overlap=None, offload_latent_to_cpu=True):
                if melody_guide and melody_guide["reference"]:
                    # The default 15-second windows caused severe system-memory
                    # pressure under WDDM. Keep the upstream two-second overlap.
                    chunk_size = 48000 * 8 if chunk_size is None else chunk_size
                    overlap = 48000 * 2 if overlap is None else overlap
                return super().tiled_encode(audio, chunk_size=chunk_size, overlap=overlap,
                                            offload_latent_to_cpu=offload_latent_to_cpu)

            def _decode_audio_codes_to_latents(self, code_str):
                code_ids = self._parse_audio_code_string(code_str)
                if not code_ids:
                    return None
                with torch.no_grad(), semantic_decoder_components(self):
                    indices = torch.tensor(code_ids, device=self.device, dtype=torch.long).unsqueeze(0).unsqueeze(-1)
                    quantized = self.model.tokenizer.quantizer.get_output_from_indices(indices).to(self.dtype)
                    return self.model.detokenizer(quantized)

            @contextmanager
            def _load_model_context(self, model_name):
                if model_name == "model":
                    if melody_guide:
                        prepare_unquantized_cpu_dtype(self)
                    adapter = staged_reference_diffusion if (melody_guide and melody_guide["reference"]) or (
                        composition and composition_strength < 1.0) else single_use_diffusion
                    with adapter(self):
                        yield
                else:
                    with super()._load_model_context(model_name):
                        yield
                    if model_name == "text_encoder" and melody_guide and melody_guide["reference"]:
                        # The pinned preprocess_batch produced all cover and
                        # non-cover text embeddings in this one context.
                        encoder, self.text_encoder = self.text_encoder, None
                        for module in encoder.modules():
                            module._parameters.clear()
                            module._buffers.clear()
                        self._release_system_memory()
                        print("Single-use text encoder released after prompt embeddings", flush=True)

        handler = LocalOnlyHandler()
        status, loaded = handler.initialize_service(
            project_root=payload["aceRoot"], config_path=payload["model"], device=payload["device"],
            use_flash_attention=False, compile_model=False, offload_to_cpu=True, offload_dit_to_cpu=True,
            quantization="int8_weight_only", use_mlx_dit=False,
        )
        if not loaded:
            print(status, file=sys.stderr, flush=True)
            raise RuntimeError("MODEL_INIT_FAILED")
        if payload["device"] == "cuda" and not handler.quantization:
            raise RuntimeError("QUANTIZATION_UNAVAILABLE")
        output_path.with_suffix(".stage").write_text("generating", encoding="utf-8")
        plan, request = payload["plan"], payload["request"]
        if __package__:
            from .performance import plan_performance
        else:
            from performance import plan_performance
        singing, performance = plan_performance(plan, instrumental=request["instrumental"])
        if composition and composition.get("performance", {}).get("preparedSha256") != performance["preparedSha256"]:
            raise RuntimeError("COMPOSITION_FAILED")
        params = GenerationParams(
            task_type="cover" if melody_guide else "text2music", caption=plan["caption"], lyrics=singing,
            instruction=TASK_INSTRUCTIONS["cover" if melody_guide else "text2music"],
            src_audio=melody_guide["path"] if melody_guide else None,
            reference_audio=melody_guide["reference"] if melody_guide else None,
            audio_cover_strength=melody_guide["strength"] if melody_guide else composition_strength,
            audio_codes=composition["audioCodes"] if composition else "",
            instrumental=request["instrumental"], vocal_language=plan["vocal_language"],
            bpm=plan["bpm"], keyscale=plan["key"], timesignature="4", duration=request["seconds"],
            inference_steps=8, guidance_scale=1.0, shift=3.0,
            thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False,
            seed=request["seed"] if request["seed"] is not None else -1,
        )
        config = GenerationConfig(batch_size=1, audio_format="wav", use_random_seed=request["seed"] is None,
                                  seeds=[request["seed"]] if request["seed"] is not None else None)
        result = generate_music(handler, None, params, config, save_dir=payload["outputDir"])
        if not result.success or not result.audios:
            if "out of memory" in (result.error or result.status_message or "").lower():
                raise RuntimeError("OUT_OF_MEMORY")
            raise RuntimeError("GENERATION_FAILED")
        audio = result.audios[0]
        output_path.write_text(json.dumps({"path": audio["path"], "seed": audio.get("params", {}).get("seed"),
                                          "performance": performance,
                                          "conditioning": {"task": "cover", "kind": "approved-hook-arrangement" if melody_guide["reference"] else "original-melody-sketch", "strength": melody_guide["strength"], "styleReference": bool(melody_guide["reference"])} if melody_guide else {
                                              "task": "cover" if composition else "text2music",
                                              "kind": "semantic-music-codes" if composition else "text",
                                              "strength": composition_strength if composition else None},
                                          "composition": dict({key: value for key, value in composition.items() if key != "audioCodes"},
                                                              conditioningStrength=composition_strength,
                                                              cached=bool(payload.get("compositionFile"))) if composition else None}),
                               encoding="utf-8")
    except Exception as exc:
        text = str(exc).lower()
        code = "OUT_OF_MEMORY" if "out of memory" in text else (
            str(exc) if str(exc) in {"CUDA_UNAVAILABLE", "MODEL_INIT_FAILED", "QUANTIZATION_UNAVAILABLE", "MODEL_MISSING", "COMPOSITION_FAILED", "ENGINE_CRASHED", "OUT_OF_MEMORY"}
            else "ENGINE_FAILED")
        # Detailed diagnostics stay in the private runner log, never the public API.
        import traceback
        traceback.print_exc()
        output_path.write_text(json.dumps({"errorCode": code}), encoding="utf-8")
        sys.exit(1)


if __name__ == "__main__":
    main()
