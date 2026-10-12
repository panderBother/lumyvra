"""Explicit, resumable preparation of audio weights or the separate composition stage."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

import httpx
from huggingface_hub import HfApi, snapshot_download

REPO = "ACE-Step/Ace-Step1.5"
REVISION = "19671f406d603126926c1b7e2adc169acbcade22"
COMPONENTS = ("acestep-v15-turbo/", "vae/", "Qwen3-Embedding-0.6B/")
LM_REPO = "ACE-Step/acestep-5Hz-lm-0.6B"
LM_REVISION = "148d8ea0225bdab342ee1ae3a354275ccd60ca80"


def direct_download(file, folder: Path, repo=REPO, revision=REVISION):
    destination = folder / file.rfilename
    destination.parent.mkdir(parents=True, exist_ok=True)
    lfs = file.lfs
    expected_hash = getattr(lfs, "sha256", None) if not isinstance(lfs, dict) else lfs.get("sha256")
    if destination.exists():
        if destination.stat().st_size != file.size:
            raise SystemExit("Existing model has an unexpected size; it was not overwritten or deleted.")
        if expected_hash:
            digest = hashlib.sha256()
            with destination.open("rb") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(block)
            if digest.hexdigest() != expected_hash:
                raise SystemExit("Existing model checksum failed; it was not overwritten or deleted.")
    else:
        partial = destination.with_suffix(destination.suffix + ".download")
        offset = partial.stat().st_size if partial.exists() else 0
        url = f"https://huggingface.co/{repo}/resolve/{revision}/{file.rfilename}?download=true"
        headers = {"Range": f"bytes={offset}-"} if offset else {}
        with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=60) as response:
            response.raise_for_status()
            if offset and (response.status_code != 206 or not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-")):
                raise SystemExit("Server did not resume this partial download; it was preserved.")
            last_report = offset
            with partial.open("ab") as output:
                for chunk in response.iter_bytes(1024 * 1024):
                    output.write(chunk)
                    offset += len(chunk)
                    if offset - last_report >= 256 * 1024**2:
                        print(json.dumps({"file": file.rfilename, "downloadedBytes": offset, "totalBytes": file.size}), flush=True)
                        last_report = offset
        if partial.stat().st_size != file.size:
            raise SystemExit("Download incomplete; retained for resume.")
        if expected_hash:
            digest = hashlib.sha256()
            with partial.open("rb") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(block)
            if digest.hexdigest() != expected_hash:
                raise SystemExit("Model checksum failed; partial retained for inspection.")
        partial.rename(destination)
    print(json.dumps({"prepared": file.rfilename, "bytes": file.size}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--direct", action="store_true", help="Use resumable HTTPS for large weights")
    parser.add_argument("--directory", type=Path, default=Path("checkpoints"))
    parser.add_argument("--profile", choices=("basic", "composition"), default="basic")
    args = parser.parse_args()
    folder = args.directory.resolve()
    composition = args.profile == "composition"
    repo, revision = (LM_REPO, LM_REVISION) if composition else (REPO, REVISION)
    if composition:
        folder = folder / "acestep-5Hz-lm-0.6B"
    info = HfApi().model_info(repo, revision=revision, files_metadata=True)
    files = [file for file in info.siblings if file.rfilename not in ("README.md", ".gitattributes")]
    if not composition:
        files = [file for file in files if file.rfilename.startswith(COMPONENTS)]
    size = sum(file.size or 0 for file in files)
    folder.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(folder).free
    print(json.dumps({"repo": repo, "revision": revision, "directory": str(folder),
                      "downloadBytes": size, "freeBytes": free, "auxiliaryLM": composition}), flush=True)
    if not args.download:
        return
    if free < size + 5 * 1024**3:
        raise SystemExit("Insufficient free disk space; nothing has been deleted.")
    if args.direct:
        small = [file.rfilename for file in files if (file.size or 0) < 100 * 1024**2]
        snapshot_download(repo, revision=revision, local_dir=folder, allow_patterns=small, max_workers=2)
        for file in files:
            if (file.size or 0) >= 100 * 1024**2:
                direct_download(file, folder, repo, revision)
    else:
        snapshot_download(repo, revision=revision, local_dir=folder,
                          allow_patterns=[file.rfilename for file in files], max_workers=2)
    (folder / "lumyvra-model-manifest.json").write_text(
        json.dumps({"repo": repo, "revision": revision, "components": ["acestep-5Hz-lm-0.6B"] if composition else COMPONENTS}), encoding="utf-8")
    print("Model files prepared. Run the runtime preflight and full-song quality evaluation separately.", flush=True)


if __name__ == "__main__":
    main()
