"""Original groove studies from reviewed production methods, not song transcriptions.

The score and synthesized conditioning audio are deliberately separate from the
actual AI output. Neither validates taste or guarantees the model follows notes.
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

from .melody_sketch import BPM, RATE, write_midi
from .references import REFERENCE_VERSION

SECONDS = 90  # 42 bars at 112 BPM.
CHORUS = ["就现在就现在", "把想念说出来", "别再隔着屏幕猜", "靠近一点别走开"]
FORM = [
    ("Intro", 2, []),
    ("Verse 1", 8, ["你说今天太忙", "消息打了又删", "咖啡放凉一半", "还在等你答案"]),
    ("Pre-Chorus 1", 4, ["其实只差一句", "我正在楼下等你"]),
    ("Chorus 1", 8, CHORUS),
    ("Verse 2", 8, ["你说外面有雨", "我把伞往你偏", "刚才那些试探", "见面就不必再猜"]),
    ("Pre-Chorus 2", 2, ["心跳替我们倒数"]),
    ("Chorus 2", 8, CHORUS),
    ("Outro", 2, []),
]
CHORDS = {
    "Cmaj7": (36, [55, 59, 60, 64]), "Am7": (33, [55, 57, 60, 64]),
    "Fmaj7": (29, [53, 57, 60, 64]), "Dm9": (38, [53, 57, 60, 64]),
    "G9": (31, [53, 57, 59, 62]),
}
PHRASES = {
    "pop": {
        "verse": [
            ([64, 64, 62, 64, 67, 64], [.5, .75, 1.25, 2, 4.5, 5.5]),
            ([62, 64, 64, 67, 65, 64], [0, 1, 1.5, 3.25, 4, 5.5]),
            ([64, 65, 64, 62, 60, 62], [.5, 1, 2, 2.5, 4.75, 5.75]),
            ([62, 64, 67, 65, 64, 62], [0, .5, 1.5, 3, 4, 5.5]),
        ],
        "pre": [
            ([64, 65, 67, 69, 67, 69], [.5, 1, 2, 3, 4.5, 5.5]),
            ([67, 69, 71, 72, 71, 69, 71], [0, .5, 1, 2, 3, 4.5, 6]),
        ],
        "chorus": [
            ([67, 69, 72, 67, 69, 72], [0, .5, 1, 4, 4.5, 5]),
            ([72, 71, 69, 67, 69, 72], [.5, 1.5, 2, 2.5, 4, 5.5]),
            ([69, 69, 72, 74, 72, 69, 67], [0, .5, 1, 2, 3.5, 4.5, 5.5]),
            ([67, 69, 67, 64, 62, 64, 64], [.5, 1, 2, 3, 4, 5, 5.5]),
        ],
    },
    "rnb": {
        "verse": [
            ([60, 62, 64, 62, 60, 64], [.75, 1.25, 2, 3.5, 4.25, 5.75]),
            ([64, 64, 62, 60, 62, 60], [.25, 1.5, 2, 2.75, 4.5, 5.25]),
            ([60, 62, 64, 65, 64, 62], [1, 1.5, 2, 3.75, 4.5, 5.75]),
            ([62, 64, 65, 64, 62, 64], [.25, .75, 1.5, 3, 4.25, 5.5]),
        ],
        "pre": [
            ([64, 65, 67, 69, 67, 65], [.5, 1, 2, 3, 4.5, 5.5]),
            ([65, 67, 69, 71, 69, 67, 67], [.25, .75, 1.5, 2.5, 3.25, 4.5, 6]),
        ],
        "chorus": [
            ([64, 67, 69, 64, 67, 69], [.5, 1.25, 2, 4.5, 5.25, 6]),
            ([69, 67, 65, 64, 62, 65], [0, 1.5, 2, 2.75, 4.5, 5.75]),
            ([67, 67, 69, 72, 71, 69, 67], [.5, 1, 1.75, 2.5, 3.5, 4.75, 5.75]),
            ([69, 67, 65, 64, 62, 64, 64], [.25, 1.25, 2, 3, 4.25, 5, 6]),
        ],
    },
}


def score(variant: str) -> dict:
    if variant not in PHRASES:
        raise ValueError("Choose pop or rnb")
    notes, sections, chords, lyrics, bar_roles = [], [], [], [], []
    cursor = 0
    for name, bars, lines in FORM:
        role = name.split()[0]
        start = cursor * 4
        if lines:
            category = "chorus" if role == "Chorus" else "pre" if role == "Pre-Chorus" else "verse"
            phrases = PHRASES[variant][category]
            for i, line in enumerate(lines):
                pitches, onsets = phrases[i % len(phrases)]
                if len(line) == 7 and len(pitches) == 6:
                    pitches, onsets = pitches[:-1] + [pitches[-1], pitches[-1]], onsets[:-1] + [5, 6]
                if len(line) != len(pitches):
                    raise ValueError("The authored guide must retain every lyric character")
                for j, (pitch, onset) in enumerate(zip(pitches, onsets, strict=True)):
                    # End each phrase before its next note, leaving consonant attacks and a breath.
                    gap = onsets[j + 1] - onset if j + 1 < len(onsets) else 7.5 - onset
                    hold = 1.5 if category == "chorus" and (j == len(pitches) - 1 or i == 0 and j == 2) else .65
                    if j == len(pitches) - 1:
                        hold = 1.35 if category == "verse" else 1.5
                    notes.append({"midi": pitch, "beat": start + i * 8 + onset,
                                  "beats": min(hold, gap - .08), "section": name, "character": line[j]})
        if role == "Chorus":
            harmony = (["Cmaj7", "Cmaj7", "Am7", "Am7", "Fmaj7", "Fmaj7", "G9", "Cmaj7"]
                       if variant == "pop" else ["Am7", "Am7", "Dm9", "Dm9", "G9", "G9", "Cmaj7", "Cmaj7"])
        elif role == "Pre-Chorus":
            harmony = ["Fmaj7", "Dm9", "G9", "G9"] if bars == 4 else ["Dm9", "G9"]
        elif role == "Outro":
            harmony = ["G9", "Cmaj7"]
        else:
            harmony = ["Am7", "Am7", "Cmaj7", "Cmaj7", "Fmaj7", "Fmaj7", "G9", "G9"]
        for local in range(bars):
            chord = harmony[local % len(harmony)]
            root, pitches = CHORDS[chord]
            chords.append({"beat": (cursor + local) * 4, "chord": chord, "root": root, "pitches": pitches})
            bar_roles.append({"role": role, "lastBeforeChorus": role == "Pre-Chorus" and local == bars - 1})
        sections.append({"name": name, "startBar": cursor, "bars": bars,
                         "startSeconds": start * 60 / BPM, "endSeconds": (start + bars * 4) * 60 / BPM,
                         "sungLines": lines})
        lyrics.extend(["[" + name + "]", *lines])
        cursor += bars
    return {"title": "就现在", "variant": variant, "bpm": BPM, "key": "C major", "seconds": SECONDS,
            "bars": cursor, "lyrics": "\n".join(lyrics), "notes": notes, "sections": sections,
            "chordBlocks": chords, "barRoles": bar_roles, "referenceVersion": REFERENCE_VERSION,
            "kind": "original-score-study", "humanReview": "pending", "glmCalls": 0,
            "commercialRecordingsUsed": False, "exactModelNoteExecutionGuaranteed": False}


def accompaniment_events(blueprint: dict) -> list[dict]:
    """Schedule real part changes; a louder unchanged loop is not a chorus arrangement."""
    events = []
    variant = blueprint["variant"]
    for bar, (block, layout) in enumerate(zip(blueprint["chordBlocks"], blueprint["barRoles"], strict=True)):
        role = layout["role"]
        full = role == "Chorus"
        kick = ([0, 1, 2, 3] if full else [0, 2.5]) if variant == "pop" else (
            [0, 1.75, 2.5, 3.5] if full else [0, 2.75])
        if role in {"Intro", "Outro"}:
            kick = []
        bass = ([0, 1.5, 2, 3.5] if full else [0, 2.5]) if variant == "pop" else kick
        keys = [.5, 1.5, 2.5, 3.5] if full and variant == "pop" else [0, 2.5]
        if variant == "mandarin":
            kick = [0, 2, 2.75] if full else [0]
            bass = [0, 1.5, 2.75] if full else [0, 2.5]
            keys = [0, 1.5, 2.5] if full else [0]
            if role in {"Intro", "Outro"}:
                kick = []
        if role in {"Intro", "Outro"}:
            bass, keys = [0], [0]
        patterns = {"kick": kick, "bass": bass, "keys": keys,
                    "rim": [1, 3] if role not in {"Intro", "Outro"} else [],
                    "hat": list(np.arange(0, 4, .5 if full or role == "Pre-Chorus" else 1))
                    if role not in {"Intro", "Outro"} else []}
        for part, hits in patterns.items():
            for i, hit in enumerate(hits):
                # A full beat of low-frequency silence opens the chorus, including note tails.
                boundary = 3 if layout["lastBeforeChorus"] else 4
                if hit >= boundary:
                    continue
                duration = float(min(.55 if part == "bass" else 1.1, boundary - hit))
                events.append({"part": part, "beat": bar * 4 + float(hit), "beats": duration,
                               "midi": block["root"] + (7 if part == "bass" and i % 3 == 1 else 0),
                               "pitches": block["pitches"], "role": role})
        # The identity is an original two-note answer; place it only in actual vocal rests.
        for offset, pitch in ((7.1, 76), (7.5, 72)):
            beat = bar * 4 + offset
            if bar % 2 == 0 and role in {"Intro", "Chorus"} and beat + .3 < blueprint["bars"] * 4:
                if not any(n["beat"] < beat + .3 and n["beat"] + n["beats"] > beat for n in blueprint["notes"]):
                    events.append({"part": "answer", "beat": beat, "beats": .3, "midi": pitch, "role": role})
    return events


def render_score(folder: Path, variant: str) -> dict:
    return render_blueprint(folder, score(variant))


def render_blueprint(folder: Path, blueprint: dict, *, render_lead: bool = True) -> dict:
    folder = folder.resolve()
    if folder.exists():
        raise FileExistsError("Preserve old candidates; choose a new directory")
    seconds, bpm = blueprint["seconds"], blueprint["bpm"]
    if not 40 <= bpm <= 240 or abs(blueprint["bars"] * 4 * 60 / bpm - seconds) > .01:
        raise ValueError("The score tempo, bar count and guide duration must agree")
    events = accompaniment_events(blueprint)
    audio = np.zeros((seconds * RATE, 2), dtype=np.float32)
    rng = np.random.default_rng(20261011)
    beat_seconds = 60 / bpm

    def add(beat, samples, gain, pan=0):
        start = round(beat * beat_seconds * RATE)
        count = min(len(samples), len(audio) - start)
        if count > 0:
            audio[start:start + count, 0] += samples[:count] * gain * (1 - pan)
            audio[start:start + count, 1] += samples[:count] * gain * (1 + pan)

    def tone(pitch, beats, keys=False):
        duration = beats * beat_seconds
        t = np.arange(round(duration * RATE), dtype=np.float32) / RATE
        phase = 2 * np.pi * 440 * 2 ** ((pitch - 69) / 12) * t
        wave = np.sin(phase) + .12 * np.sin(2 * phase)
        if keys:
            wave = np.sin(phase + np.exp(-5 * t) * np.sin(2 * phase)) * np.exp(-3 * t)
        envelope = np.minimum(t / .008, 1) * np.minimum(np.maximum(duration - t, 0) / .04, 1)
        return wave * envelope

    if render_lead:
        for note in blueprint["notes"]:
            add(note["beat"], tone(note["midi"], note["beats"]), .21)
    for event in events:
        part, beat = event["part"], event["beat"]
        if part == "keys":
            for i, pitch in enumerate(event["pitches"]):
                add(beat, tone(pitch, event["beats"], True), .022, .14 if i % 2 else -.14)
        elif part in {"bass", "answer"}:
            add(beat, tone(event["midi"], event["beats"], True), .17 if part == "bass" else .055)
        else:
            t = np.arange(round((.22 if part == "kick" else .10) * RATE), dtype=np.float32) / RATE
            if part == "kick":
                wave = np.sin(2 * np.pi * (48 * t + 90 * .025 * (1 - np.exp(-t / .025)))) * np.exp(-23 * t)
                gain = .21
            else:
                noise = rng.standard_normal(len(t)).astype(np.float32)
                wave = ((noise + .5 * np.sin(2 * np.pi * 185 * t)) * np.exp(-45 * t)
                        if part == "rim" else np.diff(noise, prepend=noise[0]) * np.exp(-90 * t))
                gain = .045 if part == "rim" else .010
            count = min(len(wave), round(event["beats"] * beat_seconds * RATE))
            wave = wave[:count] * np.minimum(t[:count] / .002, 1)
            edge = min(round(.005 * RATE), count)
            wave[-edge:] *= np.linspace(1, 0, edge, dtype=np.float32)
            add(beat, wave, gain)
    audio *= .65 / max(float(np.abs(audio).max()), 1e-6)
    audio[-RATE:] *= np.linspace(1, 0, RATE, dtype=np.float32)[:, None]
    folder.mkdir(parents=True)
    sf.write(folder / "guide.wav", audio, RATE, subtype="PCM_16")
    write_midi(folder / "melody.mid", blueprint["notes"], bpm=bpm)
    blueprint["accompanimentEvents"] = events
    (folder / "blueprint.json").write_text(json.dumps(blueprint, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "lyrics.txt").write_text(blueprint["lyrics"], encoding="utf-8")
    return blueprint
