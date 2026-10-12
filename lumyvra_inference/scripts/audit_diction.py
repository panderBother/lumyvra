"""Offline lyric-adherence probe. ASR errors are not a listening or beauty score.

Run in a separate faster-whisper environment; never load into the music worker.
The first run downloads the small ASR model, not a new music model.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import time
import unicodedata
from pathlib import Path


def normalize(text):
    from opencc import OpenCC

    text = re.sub(r"(?m)^\s*\[[^\]\n]+\]\s*$", "", text)
    canonical = OpenCC("t2s").convert(unicodedata.normalize("NFKC", text).lower())
    return "".join(c for c in canonical if c.isalnum())


def edit_distance(expected, actual):
    previous = list(range(len(actual) + 1))
    for i, left in enumerate(expected, 1):
        current = [i]
        for j, right in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--job")
    source.add_argument("--lyrics", type=Path, help="Explicit original study lyrics; no job database mutation")
    parser.add_argument("--local-only", action="store_true", help="Use cached ASR weights without downloads")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.output.exists():
        raise FileExistsError(args.output)
    if args.lyrics:
        lyrics = args.lyrics.read_text(encoding="utf-8")
    else:
        with sqlite3.connect("file:" + str(root / "data/jobs.sqlite3") + "?mode=ro", uri=True) as db:
            row = db.execute("SELECT data FROM jobs WHERE id = ?", (args.job,)).fetchone()
        if not row:
            raise ValueError("Unknown source job")
        lyrics = json.loads(row[0])["plan"]["lyrics"]
    expected = normalize(lyrics)
    from faster_whisper import WhisperModel

    started = time.monotonic()
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2, num_workers=1,
                         download_root=str(root / "data/audit-models"), local_files_only=args.local_only)
    segments, info = model.transcribe(str(args.audio.resolve()), language="zh", beam_size=5,
                                     condition_on_previous_text=False, vad_filter=False,
                                     initial_prompt=None, temperature=0.0)
    transcript = []
    for segment in segments:
        canonical = normalize(segment.text)
        transcript.append({"start": segment.start, "end": segment.end, "text": segment.text,
                           "avgLogprob": segment.avg_logprob, "noSpeechProbability": segment.no_speech_prob,
                           "suspectRepetition": len(canonical) > 20 and len(set(canonical)) <= 3})
    actual = normalize("".join(s["text"] for s in transcript))
    with args.audio.open("rb") as handle:
        audio_digest = hashlib.file_digest(handle, "sha256").hexdigest()
    report = {"kind": "local-asr-lyric-adherence-proxy", "model": "Systran/faster-whisper-small",
              "expectedLyricSha256": hashlib.sha256(lyrics.encode("utf-8")).hexdigest(),
              "compute": "cpu-int8", "language": info.language, "segments": transcript,
              "expectedCharacters": len(expected), "recognizedCharacters": len(actual),
              "characterErrorRate": edit_distance(expected, actual) / len(expected) if expected else None,
              "audioSha256": audio_digest, "normalization": "NFKC, traditional-to-simplified, alphanumeric only",
              "elapsedSeconds": time.monotonic() - started, "humanReview": "pending",
              "suspectRepetitionSegments": sum(s["suspectRepetition"] for s in transcript),
              "limitations": "Singing, accompaniment, homophones and ASR mistakes affect this proxy; not a beauty or intelligibility verdict.",
              "cloudCalls": 0}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "segments"}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
