"""Offline pronunciation and note conditioning, not a professional singing model."""
import math

import numpy as np


def syllable_boundaries(text: str, marks: list[dict], duration: float) -> list[float]:
    """Retain SAPI word starts; interpolate only inside multi-character words.

    These are approximate syllable boundaries, not phoneme-level forced alignment.
    Missing/reordered/mismatching marks fail rather than inventing or dropping text.
    """
    if not marks or not math.isfinite(duration) or duration <= 0:
        raise ValueError("Speech timing is missing")
    boundaries, cursor, previous = [], 0, -1.0
    for i, mark in enumerate(marks):
        position, count, start = mark["Position"], mark["Count"], mark["Seconds"]
        end = marks[i + 1]["Seconds"] if i + 1 < len(marks) else duration
        if (type(position) is not int or type(count) is not int or position != cursor or count <= 0
                or position + count > len(text) or mark["Text"] != text[position:position + count]
                or not all(math.isfinite(t) for t in (start, end)) or not previous < start < end <= duration):
            raise ValueError("Speech word timing does not cover the original phrase")
        boundaries.extend(start + (end - start) * j / count for j in range(count))
        cursor, previous = position + count, start
    if cursor != len(text):
        raise ValueError("Speech marks omit original text")
    return [*boundaries, duration]


def render_phrase(audio: np.ndarray, rate: int, text: str, marks: list[dict], notes: list[dict], bpm: int) -> np.ndarray:
    import pyworld as pw
    from scipy.interpolate import interp1d

    if rate < 16000 or audio.ndim != 1 or not np.isfinite(audio).all() or not 40 <= bpm <= 240:
        raise ValueError("Invalid speech audio or score tempo")
    if "".join(n["character"] for n in notes) != text:
        raise ValueError("Original phrase and note alignment differ")
    # Remove only speech tail silence, retaining the last consonant and release.
    active = np.flatnonzero(np.abs(audio) > max(float(np.abs(audio).max()) * .02, .0005))
    if not len(active):
        raise ValueError("Speech guide is silent")
    end = min(len(audio) / rate, active[-1] / rate + .10)
    boundaries = syllable_boundaries(text, marks, end)
    period = 5.0
    samples = np.ascontiguousarray(audio, dtype=np.float64)
    raw_f0, source_times = pw.dio(samples, rate, frame_period=period, f0_floor=50.0, f0_ceil=600.0)
    source_f0 = pw.stonemask(samples, raw_f0, source_times, rate)
    spectral = pw.cheaptrick(samples, source_f0, source_times, rate)
    aperiodicity = pw.d4c(samples, source_f0, source_times, rate)
    beat_seconds, first = 60 / bpm, notes[0]["beat"]
    duration = (notes[-1]["beat"] + notes[-1]["beats"] - first) * beat_seconds
    times = np.arange(math.ceil(duration * 1000 / period) + 1, dtype=np.float64) * period / 1000
    mapped, pitches, active_frames = np.full_like(times, boundaries[0]), np.zeros_like(times), np.zeros_like(times, dtype=bool)
    for i, note in enumerate(notes):
        start = (note["beat"] - first) * beat_seconds
        finish = start + note["beats"] * beat_seconds
        if finish <= start or i and notes[i - 1]["beat"] + notes[i - 1]["beats"] > note["beat"]:
            raise ValueError("Note durations or overlap are invalid")
        frames = (times >= start) & (times < finish)
        source_start, source_end = boundaries[i:i + 2]
        source_voiced = source_times[(source_times >= source_start) & (source_times < source_end) & (source_f0 > 0)]
        # Preserve brief attacks/releases; allocate extra duration chiefly to the
        # voiced nucleus instead of uniformly drawing out initial consonants.
        if len(source_voiced) > 3:
            source_attack, source_release = source_voiced[0], source_voiced[-1]
            attack = min(.12, max(.02, source_attack - source_start), (finish - start) * .2)
            release = min(.12, max(.02, source_end - source_release), (finish - start) * .2)
            mapped[frames] = np.interp(times[frames], [start, start + attack, finish - release, finish],
                                      [source_start, source_attack, source_release, source_end])
        else:
            mapped[frames] = np.interp(times[frames], [start, finish], [source_start, source_end])
        pitches[frames] = 440 * 2 ** ((note["midi"] - 69) / 12)
        active_frames[frames] = True
    nearest = np.minimum(np.searchsorted(source_times, mapped), len(source_times) - 1)
    f0 = np.where((source_f0[nearest] > 0) & active_frames, pitches, 0)
    if not np.any(f0):
        raise ValueError("No voiced nuclei found; do not substitute a sine-wave vocal")
    sp = np.ascontiguousarray(interp1d(source_times, spectral, axis=0)(mapped))
    ap = np.ascontiguousarray(interp1d(source_times, aperiodicity, axis=0)(mapped))
    sung = pw.synthesize(np.ascontiguousarray(f0), sp, ap, rate, frame_period=period)
    sung = sung[:round(duration * rate)]
    envelope = np.zeros(len(sung), dtype=np.float64)
    for note in notes:
        start = max(0, round((note["beat"] - first) * beat_seconds * rate))
        stop = min(len(sung), round((note["beat"] + note["beats"] - first) * beat_seconds * rate))
        envelope[start:stop] = 1
        edge = min(round(.004 * rate), (stop - start) // 2)
        if edge:
            envelope[start:start + edge] *= np.linspace(0, 1, edge)
            envelope[stop - edge:stop] *= np.linspace(1, 0, edge)
    return sung * envelope
