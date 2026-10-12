"""Original melodic Mandarin study, informed by methods and the user's taste.

No reference recording, commercial lyric, MIDI or transcribed note sequence is
used. These are authored conditions, not guaranteed model execution or taste.
"""
from pathlib import Path

from .original_score import render_blueprint
from .references import REFERENCE_VERSION

BPM, SECONDS = 80, 120
CHORUS = ["我没问出口你就先走", "那句别走还卡在喉咙", "后来每次有人敲门", "我都以为是你回头"]
FORM = [
    ("Intro", 2, []),
    ("Verse 1", 8, ["你把钥匙放回门边", "杯底还剩一点温热", "我把话题绕了几遍", "偏偏没问你还爱不爱我"]),
    ("Pre-Chorus 1", 4, ["窗外的车灯亮了又灭", "你说太晚我就没再说"]),
    ("Chorus 1", 8, CHORUS),
    ("Verse 2", 6, ["门口的灯换了几回", "桌上那杯早就凉透", "我还是把钥匙放在门后"]),
    ("Pre-Chorus 2", 2, ["连脚步都让我听错"]),
    ("Chorus 2", 8, CHORUS),
    ("Outro", 2, []),
]
CHORDS = {
    "Am7": (33, [55, 57, 60, 64]), "Em7": (40, [55, 59, 62, 64]),
    "Fmaj7": (29, [53, 57, 60, 64]), "Cmaj7": (36, [55, 59, 60, 64]),
    "Dm7": (38, [53, 57, 60, 65]), "Gsus4": (31, [55, 60, 62, 67]),
    "E7": (40, [56, 59, 62, 64]),
}
VERSE_PITCHES = [[57, 60, 62, 64, 62, 60, 59, 57],
                 [59, 60, 62, 64, 62, 59, 60, 59],
                 [60, 60, 62, 64, 65, 64, 62, 60],
                 [60, 62, 64, 62, 60, 59, 60, 62, 60, 59]]
CHORUS_PITCHES = [[64, 67, 69, 67, 64, 65, 67, 69, 69],
                  [64, 67, 69, 72, 71, 69, 67, 65, 64],
                  [67, 67, 69, 72, 71, 69, 74, 76],
                  [72, 71, 69, 67, 65, 64, 62, 69]]
ONSETS = {
    8: [.5, 1, 1.5, 2, 2.5, 4, 5, 6],
    9: [.5, 1, 1.5, 2, 3, 4.5, 5, 5.5, 6],
    10: [0, .5, 1, 1.5, 2.5, 3, 4, 4.5, 5.5, 6.25],
    11: [0, .5, 1, 1.5, 2, 2.5, 3.5, 4, 4.5, 5.5, 6.5],
}


def score() -> dict:
    notes, sections, blocks, roles, lyrics = [], [], [], [], []
    cursor = 0
    for name, bars, lines in FORM:
        role = name.split()[0]
        if role == "Chorus":
            harmony = ["Am7", "Am7", "Cmaj7", "Cmaj7", "Fmaj7", "Fmaj7", "E7", "Am7"]
            phrases = CHORUS_PITCHES
        elif role == "Pre-Chorus":
            harmony = ["Dm7", "Fmaj7", "Gsus4", "E7"] if bars == 4 else ["Dm7", "E7"]
            phrases = ([[62, 64, 65, 67, 69, 67, 65, 67, 68],
                        [64, 65, 67, 69, 71, 69, 67, 68, 71]] if bars == 4 else
                       [[62, 64, 65, 67, 69, 67, 68, 71]])
        else:
            harmony = ["E7", "Am7"] if role == "Outro" else ["Am7", "Em7", "Fmaj7", "Cmaj7", "Dm7", "Am7", "E7", "E7"]
            phrases = VERSE_PITCHES if name != "Verse 2" else [
                [57, 60, 62, 64, 62, 60, 59, 60], [59, 60, 62, 64, 65, 64, 62, 60],
                [60, 62, 64, 65, 64, 62, 60, 62, 60, 59]]
        for i, line in enumerate(lines):
            pitches = phrases[i]
            if len(line) != len(pitches):
                raise ValueError("Original lyric phrase and note plan differ")
            onsets = list(ONSETS[len(line)])
            if role == "Chorus" and i == 2:
                # The focal word ends the climactic phrase; do not rush its two characters.
                onsets[-2:] = [4.75, 5.75]
            if role == "Verse" and i == 1:
                onsets[0] = 0
            for j, (pitch, onset) in enumerate(zip(pitches, onsets, strict=True)):
                gap = onsets[j + 1] - onset if j + 1 < len(onsets) else 7.7 - onset
                hold = 1.55 if j == len(line) - 1 else .85 if gap >= 1 else gap - .06
                if role == "Pre-Chorus" and i == len(lines) - 1:
                    gap = min(gap, 7 - onset)  # A one-beat opening before the chorus.
                notes.append({"midi": pitch, "beat": (cursor + i * 2) * 4 + onset,
                              "beats": min(hold, gap - .06), "section": name, "character": line[j]})
        for local in range(bars):
            chord = harmony[local % len(harmony)]
            root, pitches = CHORDS[chord]
            blocks.append({"beat": (cursor + local) * 4, "chord": chord, "root": root, "pitches": pitches})
            roles.append({"role": role, "lastBeforeChorus": role == "Pre-Chorus" and local == bars - 1})
        sections.append({"name": name, "startBar": cursor, "bars": bars,
                         "startSeconds": cursor * 4 * 60 / BPM,
                         "endSeconds": (cursor + bars) * 4 * 60 / BPM, "sungLines": lines})
        lyrics.extend(["[" + name + "]", *lines])
        cursor += bars
    return {"title": "没问出口", "variant": "mandarin", "bpm": BPM, "seconds": SECONDS,
            "key": "A minor", "bars": cursor, "lyrics": "\n".join(lyrics), "notes": notes,
            "sections": sections, "chordBlocks": blocks, "barRoles": roles,
            "referenceVersion": REFERENCE_VERSION, "profile": "mandarin_melodic",
            "kind": "original-mandarin-melodic-score-study", "humanReview": "pending", "glmCalls": 0,
            "commercialRecordingsUsed": False, "referenceNotesTranscribed": False,
            "exactModelNoteExecutionGuaranteed": False}


def render_mandarin_score(folder: Path) -> dict:
    return render_blueprint(folder, score())
