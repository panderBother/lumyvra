"""A one-minute verse-to-chorus study grounded in the liked B recording.

The source recording conditions inference; no part is pasted into the final song.
Nominal bar positions are a guide, not verified alignment of the sampled vocals.
"""
import json
import shutil
from pathlib import Path

import numpy as np
import soundfile as sf

from .hook_song import fingerprint, song_blueprint
from .melody_sketch import BPM, RATE, render_arrangement_audio, write_midi

SECONDS = 60


def transition_blueprint():
    full = song_blueprint()
    notes, blocks, sections, energies, lyrics = [], [], [], [], []
    bar = 0
    # Start with a verse; keep the approved four-line chorus intact on both passes.
    layout = [("Verse", "Verse 1", 8, 4, .65), ("Pre-Chorus", "Pre-Chorus 1", 4, 2, .82),
              ("Chorus 1", "Chorus 1", 8, 4, 1.0), ("Chorus 2", "Chorus 1", 8, 4, 1.0)]
    for name, source_name, bars, line_count, energy in layout:
        source = next(section for section in full["sections"] if section["name"] == source_name)
        old_start, new_start = source["startBar"] * 4, bar * 4
        lines = source["sungLines"][:line_count]
        notes.extend(dict(note, beat=note["beat"] - old_start + new_start, section=name)
                     for note in full["notes"] if note["section"] == source_name
                     and note["beat"] < old_start + bars * 4)
        blocks.extend(dict(block, beat=block["beat"] - old_start + new_start)
                      for block in full["chordBlocks"] if old_start <= block["beat"] < old_start + bars * 4)
        sections.append({"name": name, "startBar": bar, "bars": bars, "sungLines": lines,
                         "startSeconds": new_start * 60 / BPM,
                         "endSeconds": (new_start + bars * 4) * 60 / BPM})
        lyrics.extend(["[Chorus]" if name.startswith("Chorus") else "[" + name + "]", *lines])
        energies.extend([energy] * bars)
        bar += bars
    return {"title": "先别说晚安 · 过渡试听", "seconds": SECONDS, "bars": bar, "bpm": BPM,
            "key": "C major", "notes": notes, "chordBlocks": blocks, "sections": sections,
            "energies": energies, "lyrics": "\n".join(lyrics), "humanReview": "pending",
            "scope": "one-minute-transition-study-not-full-song", "glmCalls": 0,
            "exactMelodyRetentionGuaranteed": False}


def render_transition_guide(folder: Path, approved_song: Path):
    folder, approved_song = folder.resolve(), approved_song.resolve()
    if folder.exists():
        raise FileExistsError("Use a new candidate directory")
    info = sf.info(approved_song)
    if info.samplerate != RATE or info.channels != 2 or abs(info.duration - 36) > .02:
        raise ValueError("Expected the liked 36-second stereo B recording")
    digest = fingerprint(approved_song)
    approved, _ = sf.read(approved_song, dtype="float32", always_2d=True)
    if not np.isfinite(approved).all() or np.max(np.abs(approved)) < .001:
        raise ValueError("Unusable approved recording")
    blueprint = transition_blueprint()
    guide = render_arrangement_audio(blueprint["notes"], blueprint["chordBlocks"],
                                     blueprint["bars"], SECONDS, blueprint["energies"]) * .45
    choruses = [section for section in blueprint["sections"] if section["name"].startswith("Chorus")]
    start = round(choruses[0]["startSeconds"] * RATE)
    count = len(guide) - start
    if len(approved) < count:
        raise ValueError("Approved audio is too short for both chorus slots")
    blend = np.ones((count, 1), dtype=np.float32)
    edge = round(.08 * RATE)
    blend[:edge, 0] = np.linspace(0, 1, edge)
    guide[start:] = guide[start:] * (1 - blend) + approved[:count] * blend
    # Keep a short tail inside the nominal final bar.
    fade = round(.65 * RATE)
    guide[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    folder.mkdir(parents=True, exist_ok=False)
    sf.write(folder / "guide.wav", guide, RATE, subtype="PCM_16")
    shutil.copyfile(approved_song, folder / "approved-b.wav")
    if fingerprint(approved_song) != digest or fingerprint(folder / "approved-b.wav") != digest:
        raise RuntimeError("Approved source changed")
    write_midi(folder / "melody.mid", blueprint["notes"])
    blueprint.update(kind="transition-guide-not-generated-song", approvedSource={
        "path": str(approved_song), "sha256": digest, "userFeedback": "B不错", "reviewScope": "36-second direction only"})
    (folder / "blueprint.json").write_text(json.dumps(blueprint, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "lyrics.txt").write_text(blueprint["lyrics"], encoding="utf-8")
    return blueprint
