"""Original connected lyric and comfortable-register guide; no reference transcription."""
from .mandarin_melodic_score import ONSETS
from .references import REFERENCE_VERSION

BPM, SECONDS = 80, 120
CHORUS = ["留一盏灯等我回家", "让晚风吹干我肩上的雨", "世界再大也有个地方", "接住我没说完的委屈"]
FORM = [
    ("Intro", 2, []),
    ("Verse 1", 8, ["末班车越过旧街口", "雨点轻敲起雾的窗", "心事停在发送键旁", "怕你看出我还在逞强"]),
    ("Pre-Chorus 1", 4, ["屏幕亮起一句到哪了", "我忽然有话想对你讲"]),
    ("Chorus 1", 8, CHORUS),
    ("Verse 2", 4, ["你没有问今天怎样", "只把热汤放在桌上"]),
    ("Pre-Chorus 2", 4, ["那些忍了一路的话", "在你面前终于能慢慢讲"]),
    ("Chorus 2", 8, CHORUS),
    ("Outro", 2, []),
]
CHORDS = {
    "Gmaj7": (31, [55, 59, 62, 66]), "Em7": (28, [55, 59, 62, 64]),
    "Cmaj7": (36, [55, 59, 60, 64]), "Am7": (33, [55, 57, 60, 64]),
    "D7": (38, [54, 57, 60, 62]), "Bm7": (35, [54, 57, 59, 62]),
}
PITCHES = {
    "Verse 1": [[55, 57, 59, 59, 57, 55, 54, 55], [54, 55, 57, 59, 57, 55, 54, 52],
                [55, 55, 57, 59, 60, 59, 57, 55], [55, 57, 59, 57, 55, 54, 55, 57, 54]],
    "Verse 2": [[55, 57, 59, 59, 57, 55, 54, 55], [54, 55, 57, 59, 60, 59, 57, 55]],
    "Pre-Chorus 1": [[57, 59, 60, 62, 64, 62, 60, 59, 57], [59, 60, 62, 64, 62, 60, 59, 57, 54]],
    "Pre-Chorus 2": [[57, 59, 60, 62, 64, 62, 60, 59], [59, 60, 62, 64, 62, 60, 59, 57, 55, 54]],
    "Chorus": [[59, 62, 64, 64, 62, 60, 59, 55], [59, 62, 64, 64, 62, 60, 62, 64, 62, 59],
               [60, 60, 62, 67, 66, 64, 62, 60, 62], [64, 62, 59, 60, 62, 64, 62, 57, 55]],
}


def score() -> dict:
    notes, sections, blocks, roles, lyrics = [], [], [], [], []
    cursor = 0
    for name, bars, lines in FORM:
        role = name.split()[0]
        if role == "Chorus":
            harmony = ["Gmaj7", "Gmaj7", "Cmaj7", "Cmaj7", "Am7", "D7", "Em7", "Gmaj7"]
        elif role == "Pre-Chorus":
            harmony = ["Am7", "Cmaj7", "D7", "D7"]
        elif role == "Outro":
            harmony = ["D7", "Gmaj7"]
        else:
            harmony = ["Em7", "Bm7", "Cmaj7", "Gmaj7", "Am7", "Em7", "D7", "D7"]
        phrases = PITCHES.get("Chorus" if role == "Chorus" else name, [])
        for i, line in enumerate(lines):
            pitches = phrases[i]
            if len(pitches) != len(line):
                raise ValueError(f"Authored phrase {name}/{i} has mismatched syllables")
            onsets = list(ONSETS[len(line)])
            if role == "Chorus" and i == 0:
                onsets = [.5, 1, 1.5, 2, 4, 4.5, 5, 6]
            for j, (pitch, onset) in enumerate(zip(pitches, onsets, strict=True)):
                end = onsets[j + 1] - .06 if j + 1 < len(line) else 7.5
                if role == "Pre-Chorus" and i == len(lines) - 1:
                    end = min(end, 7)
                # Keep semantic words connected, with a real rest after the core phrase.
                if role == "Chorus" and i == 0 and j == 3:
                    end = 3.5
                notes.append({"midi": pitch, "beat": (cursor + i * 2) * 4 + onset,
                              "beats": end - onset, "section": name, "character": line[j], "line": i})
        for local in range(bars):
            chord = harmony[local % len(harmony)]
            root, pitches = CHORDS[chord]
            blocks.append({"beat": (cursor + local) * 4, "chord": chord, "root": root, "pitches": pitches})
            roles.append({"role": role, "lastBeforeChorus": role == "Pre-Chorus" and local == bars - 1})
        sections.append({"name": name, "startBar": cursor, "bars": bars, "sungLines": lines,
                         "startSeconds": cursor * 4 * 60 / BPM,
                         "endSeconds": (cursor + bars) * 4 * 60 / BPM})
        lyrics.extend(["[" + name + "]", *lines])
        cursor += bars
    return {"title": "留一盏灯", "variant": "mandarin", "bpm": BPM, "seconds": SECONDS, "key": "G major",
            "bars": cursor, "lyrics": "\n".join(lyrics), "notes": notes, "sections": sections,
            "chordBlocks": blocks, "barRoles": roles, "referenceVersion": REFERENCE_VERSION,
            "kind": "original-lyric-and-vocal-guide-study", "humanReview": "pending", "glmCalls": 0,
            "commercialRecordingsUsed": False, "exactModelNoteExecutionGuaranteed": False}
