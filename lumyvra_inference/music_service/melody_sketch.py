"""Two deliberately small, original hook studies; diagnostic material, not a song model.

General contour/repetition ideas come from the reviewed reference notes. None of
the reference tracks' transcribed notes, lyrics, recordings or MIDI are imported.
"""
import json
import struct
from pathlib import Path

import numpy as np
import soundfile as sf

from .references import REFERENCE_VERSION, SOURCES

BPM = 112
RATE = 48000
LYRICS = "[Chorus]\n先别说晚安\n再绕一个弯\n你走慢一点\n让我多看你一眼\n[Chorus]\n先别说晚安\n再绕一个弯\n你走慢一点\n让我多看你一眼\n[Outro]"

# MIDI pitches, beat offsets and note lengths. Four two-bar lines: A A' B A-answer.
# These note sequences were authored here, not transcribed from a reference song.
HOOKS = {
    "a": [
        [(67, .5, .4), (67, 1, .4), (69, 1.5, .8), (67, 2.5, 1), (64, 4, 1.8)],
        [(67, .5, .4), (67, 1, .4), (69, 1.5, .8), (67, 2.5, 1), (65, 4, 1.8)],
        [(64, .5, .8), (67, 1.5, .4), (69, 2, .8), (67, 3, 1), (64, 4.5, 1.3)],
        [(65, 0, .4), (64, .5, .8), (62, 1.5, .4), (64, 2, .4), (62, 2.5, .8),
         (60, 3.5, .8), (60, 4.5, 1.8)],
    ],
    "b": [
        [(64, .75, .35), (64, 1.25, .35), (67, 1.75, 1), (69, 3.25, .7), (67, 4.5, 1.2)],
        [(64, .75, .35), (64, 1.25, .35), (67, 1.75, 1), (69, 3.25, .7), (65, 4.5, 1.2)],
        [(67, .75, .35), (69, 1.25, .35), (72, 1.75, 1), (69, 3.25, .7), (67, 4.5, 1.2)],
        [(69, .75, .35), (67, 1.25, .35), (65, 1.75, .55), (64, 2.5, .35), (62, 3, .8),
         (64, 4.5, .5), (60, 5.25, 1.2)],
    ],
}
CHORDS = [("Fmaj7", 41, [53, 60, 64, 69]), ("G9", 43, [55, 59, 65, 69]),
          ("Em7", 40, [52, 59, 62, 67]), ("Am7", 45, [57, 60, 64, 67])]


def original_notes(variant: str) -> list[dict]:
    phrases = HOOKS[variant]
    return [{"midi": pitch, "beat": repeat * 32 + line * 8 + beat, "beats": duration}
            for repeat in range(2) for line, phrase in enumerate(phrases)
            for pitch, beat, duration in phrase]


def _variable_length(value: int) -> bytes:
    result = [value & 127]
    while value >> 7:
        value >>= 7
        result.insert(0, (value & 127) | 128)
    return bytes(result)


def write_midi(path: Path, notes: list[dict], *, bpm: int = BPM):
    if isinstance(bpm, bool) or not isinstance(bpm, int) or not 40 <= bpm <= 240:
        raise ValueError("MIDI tempo must be an integer between 40 and 240 BPM")
    ticks = 480
    tempo = round(60000000 / bpm).to_bytes(3, "big")
    events = [(0, b"\xff\x51\x03" + tempo), (0, b"\xff\x58\x04\x04\x02\x18\x08")]
    for note in notes:
        start = round(note["beat"] * ticks)
        end = round((note["beat"] + note["beats"]) * ticks)
        events.extend([(start, bytes([0x90, note["midi"], 94])), (end, bytes([0x80, note["midi"], 0]))])
    previous, data = 0, bytearray()
    # Note-off precedes note-on at a coinciding tick.
    for tick, event in sorted(events, key=lambda item: (item[0], item[1][0])):
        data.extend(_variable_length(tick - previous) + event)
        previous = tick
    data.extend(b"\x00\xff\x2f\x00")
    path.write_bytes(b"MThd" + struct.pack(">IHHH", 6, 0, 1, ticks) + b"MTrk" + struct.pack(">I", len(data)) + data)


def render_arrangement_audio(notes: list[dict], chord_blocks: list[dict], bars: int, seconds: int,
                             energies: list[float] | None = None) -> np.ndarray:
    """Render a timing/melody guide; this is never a finished AI song."""
    if energies is not None and len(energies) != bars:
        raise ValueError("One energy value is required per bar")
    audio = np.zeros((round(seconds * RATE), 2), dtype=np.float32)
    beat_seconds = 60 / BPM
    rng = np.random.default_rng(4821)

    def add(samples, beat, amplitude, pan=0):
        offset = round(beat * beat_seconds * RATE)
        if energies is not None:
            amplitude *= energies[min(int(beat // 4), bars - 1)]
        count = min(len(samples), len(audio) - offset)
        if count > 0:
            audio[offset:offset + count, 0] += samples[:count] * amplitude * (1 - pan)
            audio[offset:offset + count, 1] += samples[:count] * amplitude * (1 + pan)

    def tone(pitch, beats, timbre="lead"):
        duration = beats * beat_seconds
        t = np.arange(round(duration * RATE), dtype=np.float32) / RATE
        frequency = 440 * 2 ** ((pitch - 69) / 12)
        phase = 2 * np.pi * frequency * t
        if timbre == "keys":
            wave = np.sin(phase + 1.5 * np.exp(-4 * t) * np.sin(2 * phase)) * np.exp(-2.5 * t)
        elif timbre == "bass":
            wave = (np.sin(phase) + .15 * np.sin(2 * phase)) * np.exp(-3 * t)
        else:
            wave = .75 * np.sin(phase) + .18 * np.sin(2 * phase) + .05 * np.sin(3 * phase)
        envelope = np.minimum(t / .008, 1) * np.minimum(np.maximum(duration - t, 0) / .035, 1)
        return (wave * envelope).astype(np.float32)

    for note in notes:
        add(tone(note["midi"], note["beats"]), note["beat"], .25)
    for block in chord_blocks:
        start, root, chord = block["beat"], block["root"], block["pitches"]
        for strike in (0, 2.5, 4, 6.5):
            for index, pitch in enumerate(chord):
                add(tone(pitch, 1.25, "keys"), start + strike + index * .025, .034, .12 * (index % 2 * 2 - 1))
        for hit, pitch in ((0, root), (1.5, root + 7), (2.75, root), (4, root), (5.5, root + 7), (6.75, root)):
            add(tone(pitch, .65, "bass"), start + hit, .16)
    for bar in range(bars):
        for hit in (0, 1.5, 2.75):
            t = np.arange(round(.22 * RATE), dtype=np.float32) / RATE
            phase = 2 * np.pi * (48 * t + 85 * .028 * (1 - np.exp(-t / .028)))
            kick = np.sin(phase) * np.exp(-22 * t) * np.minimum(t / .002, 1)
            add(kick, bar * 4 + hit, .22)
        for hit in (1, 3):
            t = np.arange(round(.14 * RATE), dtype=np.float32) / RATE
            noise = rng.standard_normal(len(t)).astype(np.float32)
            rim = (.5 * noise + .5 * np.sin(2 * np.pi * 185 * t)) * np.exp(-38 * t)
            add(rim, bar * 4 + hit, .06)
        for hit in np.arange(0, 4, .5):
            t = np.arange(round(.05 * RATE), dtype=np.float32) / RATE
            noise = rng.standard_normal(len(t)).astype(np.float32)
            hat = np.diff(noise, prepend=noise[0]) * np.exp(-85 * t)
            add(hat, bar * 4 + hit, .012 if hit % 1 else .008, -.15)
    audio *= .85 / max(float(np.abs(audio).max()), 1e-6)
    return audio


def render_sketch(folder: Path, variant: str, seconds: int = 36) -> dict:
    if seconds < 35 or seconds > 45:
        raise ValueError("This sixteen-bar diagnostic sketch requires 35-45 seconds")
    notes = original_notes(variant)
    folder.mkdir(parents=True, exist_ok=True)
    guide = folder / "guide.wav"
    if guide.exists() or (folder / "hook.mid").exists():
        raise FileExistsError("Preserve the existing sketch; choose a new output directory")
    blocks = [{"beat": repeat * 32 + line * 8, "root": root, "pitches": chord}
              for repeat in range(2) for line, (_, root, chord) in enumerate(CHORDS)]
    audio = render_arrangement_audio(notes, blocks, 16, seconds)
    sf.write(guide, audio, RATE, subtype="PCM_16")
    write_midi(folder / "hook.mid", notes)
    blueprint = {"kind": "original-diagnostic-sketch", "notFinishedSong": True,
                 "variant": variant, "bpm": BPM, "key": "C major", "seconds": seconds,
                 "lyrics": LYRICS, "notes": notes, "form": "A A-prime B answer, repeated once",
                 "harmony": [chord[0] for chord in CHORDS], "referenceVersion": REFERENCE_VERSION,
                 "knowledgeRefs": [{"id": source["id"], "url": source["url"]} for source in SOURCES],
                 "audioTrainingPerformed": False, "referenceRecordingsDownloaded": False,
                 "humanReview": "pending"}
    (folder / "blueprint.json").write_text(json.dumps(blueprint, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "lyrics.txt").write_text(LYRICS, encoding="utf-8")
    return blueprint
