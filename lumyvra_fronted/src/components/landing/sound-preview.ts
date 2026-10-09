export type SoundPreview = { analyser: AnalyserNode; stop: () => void };
/** Original local ambient sketch; no autoplay, network audio, or claimed AI output. */
export async function startSoundPreview(
  onEnded: () => void,
): Promise<SoundPreview> {
  const context = new AudioContext();
  try {
    await context.resume();
  } catch (error) {
    await context.close();
    throw error;
  }
  const master = context.createGain(),
    analyser = context.createAnalyser(),
    filter = context.createBiquadFilter(),
    delay = context.createDelay(2),
    feedback = context.createGain(),
    wet = context.createGain();
  analyser.fftSize = 64;
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  feedback.gain.value = 0.22;
  wet.gain.value = 0.2;
  delay.delayTime.value = 0.375;
  filter.connect(master);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  master.connect(analyser);
  analyser.connect(context.destination);
  const now = context.currentTime + 0.08;
  master.gain.setValueAtTime(0, context.currentTime);
  master.gain.linearRampToValueAtTime(0.42, now + 1);
  master.gain.setValueAtTime(0.42, now + 21);
  master.gain.linearRampToValueAtTime(0, now + 24);
  function note(
    midi: number,
    start: number,
    duration: number,
    gain: number,
    type: OscillatorType,
  ) {
    const osc = context.createOscillator(),
      env = context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(
      gain,
      start + Math.min(0.12, duration * 0.1),
    );
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(filter);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }
  const chords = [
    [48, 55, 59, 64],
    [45, 52, 55, 60],
    [41, 48, 52, 57],
    [43, 50, 55, 59],
  ];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4],
      time = now + bar * 2.625;
    chord.forEach((pitch, i) =>
      note(pitch, time + i * 0.035, 3.4, 0.055, "sine"),
    );
    for (let beat = 0; beat < 7; beat++)
      note(
        chord[[0, 2, 1, 3, 2, 1, 3][beat]] + 12,
        time + beat * 0.375,
        1.45,
        0.065,
        "triangle",
      );
    note(chord[0] - 12, time, 2.5, 0.1, "sine");
  }
  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    void context.close().catch(() => {});
  };
  const timer = window.setTimeout(() => {
    finish();
    onEnded();
  }, 24200);
  return { analyser, stop: finish };
}
