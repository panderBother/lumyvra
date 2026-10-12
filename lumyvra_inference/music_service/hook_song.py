"""A complete original arrangement around the user-approved B chorus.

The approved model output is an input reference, never a substitute for the
new full-song inference. Its bytes and the original experiment stay untouched.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf

from .melody_sketch import BPM, CHORDS, HOOKS, RATE, render_arrangement_audio, write_midi

SECONDS = 180
CHORUS = ["先别说晚安", "再绕一个弯", "你走慢一点", "让我多看你一眼"]
# Exactly 84 bars at 112 BPM = 180 seconds. Each sung line has two bars.
SECTIONS = [
    ("Intro", 4, [], .5),
    ("Verse 1", 12, ["便利店快打烊", "你捧着半杯热茶", "门口的风有点凉", "我说等雨小一点",
                      "其实雨早就停了", "你笑着没有拆穿"], .72),
    ("Pre-Chorus 1", 4, ["红灯又换成绿灯", "我们还站在原地"], .86),
    ("Chorus 1", 8, CHORUS, 1),
    ("Post-Chorus", 4, [], .9),
    ("Verse 2", 12, ["你问明天忙不忙", "我说傍晚都有空", "手机亮了又熄了", "谁都没看那一眼",
                      "路口明明该左转", "你却说右边好看"], .76),
    ("Pre-Chorus 2", 4, ["绿灯倒数到最后", "我们还是没往前"], .9),
    ("Chorus 2", 8, CHORUS, 1),
    ("Bridge", 8, ["不用再找个借口", "其实我早就听懂", "你要是也舍不得", "就把明天留给我"], .6),
    ("Final Chorus", 16, CHORUS * 2, 1),
    ("Outro", 4, [], .5),
]
VERSE_PITCHES = [
    [60, 62, 64, 64, 62, 60], [60, 62, 64, 67, 64, 62, 60],
    [62, 64, 65, 65, 64, 62, 60], [64, 64, 65, 67, 65, 64, 62],
    [64, 62, 60, 62, 64, 65, 64], [62, 64, 65, 64, 62, 60, 60],
]
PRE_PITCHES = [[64, 65, 67, 69, 67, 65, 67], [65, 67, 69, 69, 67, 65, 67]]
BRIDGE_PITCHES = [[65, 64, 62, 60, 62, 64, 65], [64, 62, 60, 62, 64, 67, 64],
                  [62, 64, 65, 67, 65, 64, 62], [64, 65, 67, 69, 67, 65, 64]]
VERSE_HARMONY = [CHORDS[3], CHORDS[2], CHORDS[0], CHORDS[1]]
BRIDGE_HARMONY = [CHORDS[0], CHORDS[2], ("Dm7", 38, [50, 57, 60, 65]), CHORDS[1]]


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _phrase(pitches: list[int]) -> list[tuple]:
    # 6-7 syllables with room for a held final note and a breath.
    onsets = [.75, 1.25, 1.75, 2.5, 3.25, 4.5, 5.25]
    return [(pitch, onsets[i], 1.1 if i == len(pitches) - 1 else (.5 if i > 1 else .35))
            for i, pitch in enumerate(pitches)]


def song_blueprint() -> dict:
    notes, sections, blocks, energies, lyrics = [], [], [], [], []
    bar = 0
    for name, bars, lines, energy in SECTIONS:
        start = bar * 4
        if lines:
            if name.startswith("Chorus") or name == "Final Chorus":
                phrases, harmony = [HOOKS["b"][i % 4] for i in range(len(lines))], CHORDS
            elif name.startswith("Pre-Chorus"):
                phrases, harmony = [_phrase(p) for p in PRE_PITCHES], [CHORDS[0], CHORDS[1]]
            elif name == "Bridge":
                phrases, harmony = [_phrase(p) for p in BRIDGE_PITCHES], BRIDGE_HARMONY
            else:
                phrases = [_phrase(p) for p in VERSE_PITCHES]
                if name == "Verse 2":
                    # A small answering change, without turning the verse into a second chorus.
                    phrases = [[(p + (2 if i == 0 and p <= 64 else 0), b, d) for i, (p, b, d) in enumerate(phrase)]
                               for phrase in phrases]
                    phrases[0] = _phrase([62, 62, 64, 65, 64, 62, 60])
                harmony = VERSE_HARMONY
            for line, phrase in enumerate(phrases):
                notes.extend({"midi": p, "beat": start + line * 8 + b, "beats": d, "section": name}
                             for p, b, d in phrase)
        else:
            harmony = CHORDS
            if name == "Post-Chorus":
                notes.extend({"midi": p, "beat": start + b, "beats": d, "section": name}
                             for p, b, d in HOOKS["b"][0])
            elif name == "Outro":
                notes.extend({"midi": p, "beat": start + b, "beats": d, "section": name}
                             for p, b, d in [(64, .75, .5), (62, 1.5, .5), (60, 2.5, 2)])
                harmony = [CHORDS[0], ("Cmaj9", 36, [48, 55, 59, 62, 64])]
        for i in range(bars // 2):
            chord, root, pitches = harmony[i % len(harmony)]
            blocks.append({"beat": start + i * 8, "chord": chord, "root": root, "pitches": pitches})
        sections.append({"name": name, "startBar": bar, "bars": bars, "startSeconds": start * 60 / BPM,
                         "endSeconds": (start + bars * 4) * 60 / BPM, "sungLines": lines})
        energies.extend([energy] * bars)
        tag = "Chorus" if name.startswith("Chorus") or name == "Final Chorus" else name.split(" 1")[0].split(" 2")[0]
        lyrics.append("[" + tag + "]")
        lyrics.extend(lines)
        bar += bars
    return {"title": "先别说晚安", "bpm": BPM, "key": "C major", "seconds": SECONDS, "bars": bar,
            "sections": sections, "lyrics": "\n".join(lyrics), "notes": notes, "chordBlocks": blocks,
            "energies": energies, "lyricSource": "original-authored-for-this-arrangement", "glmCalls": 0,
            "approvedDirection": "B", "humanReview": "pending", "exactMelodyRetentionGuaranteed": False}


def render_full_guide(folder: Path, approved_song: Path) -> dict:
    """Synthesized new sections + approved generated B audio in chorus guide slots."""
    folder = folder.resolve()
    if folder.exists():
        raise FileExistsError("Use a new directory; never overwrite an existing candidate")
    approved_song = approved_song.resolve()
    if not approved_song.is_file():
        raise ValueError("The approved B model output is required")
    info = sf.info(approved_song)
    if info.samplerate != RATE or info.channels != 2 or abs(info.duration - 36) > .02:
        raise ValueError("Expected the approved 36-second, 48kHz stereo B song")
    blueprint = song_blueprint()
    original_hash = fingerprint(approved_song)
    approved, _ = sf.read(approved_song, dtype="float32", always_2d=True)
    if not np.isfinite(approved).all() or np.max(np.abs(approved)) < .001:
        raise ValueError("Approved B reference is not usable audio")
    folder.mkdir(parents=True)
    guide = render_arrangement_audio(blueprint["notes"], blueprint["chordBlocks"],
                                     blueprint["bars"], SECONDS, blueprint["energies"])
    guide *= .45  # Chorus audio has its own dynamics; avoid a much louder synthetic verse.
    for section in blueprint["sections"]:
        if section["name"] not in ("Chorus 1", "Chorus 2", "Final Chorus"):
            continue
        start = round(section["startSeconds"] * RATE)
        count = round((section["endSeconds"] - section["startSeconds"]) * RATE)
        # Nominal guide tempo, not a claim that the sampled recording is beat-perfect.
        src_start = round(32 * 60 / BPM * RATE) if section["name"] == "Chorus 2" else 0
        clip = approved[src_start:src_start + count]
        if len(clip) != count:
            raise ValueError("Approved B recording is too short for the planned chorus")
        blend = np.ones((count, 1), dtype=np.float32)
        edge = min(round(.08 * RATE), count // 2)
        blend[:edge, 0] = np.linspace(0, 1, edge)
        blend[-edge:, 0] = np.linspace(1, 0, edge)
        guide[start:start + count] = guide[start:start + count] * (1 - blend) + clip * blend
    fade = round(1.8 * RATE)
    guide[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    sf.write(folder / "guide.wav", guide, RATE, subtype="PCM_16")
    # A separate style reference, with exactly the approved source bytes.
    import shutil
    shutil.copyfile(approved_song, folder / "approved-b.wav")
    if fingerprint(approved_song) != original_hash or fingerprint(folder / "approved-b.wav") != original_hash:
        raise RuntimeError("Approved B source changed")
    write_midi(folder / "melody.mid", blueprint["notes"])
    blueprint["approvedSource"] = {"path": str(approved_song), "sha256": original_hash,
                                   "userFeedback": "B不错", "reviewScope": "36-second direction only"}
    blueprint["kind"] = "full-arrangement-guide-not-finished-song"
    (folder / "blueprint.json").write_text(json.dumps(blueprint, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "lyrics.txt").write_text(blueprint["lyrics"], encoding="utf-8")
    return blueprint
