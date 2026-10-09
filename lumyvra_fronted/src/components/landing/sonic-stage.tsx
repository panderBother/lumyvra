"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { SoundField } from "./sound-field";
import { startSoundPreview, type SoundPreview } from "./sound-preview";
import { useLandingMotion } from "./landing-motion";
export function SonicStage() {
  const host = useRef<HTMLDivElement>(null),
    field = useRef<SoundField | null>(null),
    preview = useRef<SoundPreview | null>(null),
    mounted = useRef(false),
    starting = useRef(false);
  const { paused, setPaused } = useLandingMotion();
  const [playing, setPlaying] = useState(false),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const el = host.current;
    if (!el) return;
    let disposed = false;
    import("./sound-field")
      .then(({ createSoundField }) => {
        if (disposed) return;
        try {
          field.current = createSoundField(el, () => {
            if (!disposed) setReady(false);
          });
          field.current.setAnalyser(preview.current?.analyser ?? null);
          setReady(true);
        } catch {
          setReady(false);
        }
      })
      .catch(() => {
        if (!disposed) setReady(false);
      });
    const visibility = () => {
      if (document.hidden) {
        preview.current?.stop();
        preview.current = null;
        field.current?.setAnalyser(null);
        setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      mounted.current = false;
      field.current?.dispose();
      field.current = null;
      preview.current?.stop();
      preview.current = null;
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    field.current?.setPaused(paused);
  }, [paused, ready]);
  async function toggleSound() {
    if (starting.current) return;
    if (preview.current) {
      preview.current.stop();
      preview.current = null;
      field.current?.setAnalyser(null);
      setPlaying(false);
      return;
    }
    starting.current = true;
    try {
      const sound = await startSoundPreview(() => {
        preview.current = null;
        field.current?.setAnalyser(null);
        if (mounted.current) setPlaying(false);
      });
      if (!mounted.current || document.hidden) {
        sound.stop();
        return;
      }
      preview.current = sound;
      field.current?.setAnalyser(sound.analyser);
      setPlaying(true);
      setNotice("");
    } catch {
      if (mounted.current) setNotice("浏览器暂时无法播放音频，请稍后再试。");
    } finally {
      starting.current = false;
    }
  }
  return (
    <>
      <div
        className={`sonic-stage ${ready ? "is-ready" : ""} ${paused ? "is-paused" : ""}`}
        aria-hidden="true"
      >
        <div className="sonic-fallback">
          <div />
          <div />
          <div />
        </div>
        <div className="sonic-canvas" ref={host} />
      </div>
      {ready && !paused && (
        <p className="sonic-interaction-hint" aria-hidden="true">
          <span className="mouse-interaction-hint">
            移动拨开粒子 · 按住拖动 · 点击扩散
          </span>
          <span className="touch-interaction-hint">
            轻触粒子，让声场泛起波纹
          </span>
        </p>
      )}
      <div className="sonic-controls">
        <button
          className={`sound-preview ${playing ? "is-playing" : ""}`}
          onClick={toggleSound}
          aria-pressed={playing}
        >
          <span className="sound-preview-icon">
            {playing ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </span>
          <span>
            <strong>
              {playing ? "正在聆听 · 暮色" : "先听一段，找找感觉"}
            </strong>
            <small>合成音色试听 · 24 秒</small>
          </span>
          <span className="sound-meter" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </span>
        </button>
          <button
            className="motion-control"
            onClick={() => {
              field.current?.setPaused(!paused);
              setPaused(!paused);
            }}
            aria-label={paused ? "继续页面动效" : "暂停页面动效"}
            title={paused ? "继续页面动效" : "暂停页面动效"}
            aria-pressed={paused}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
      </div>
      {notice && (
        <p className="sound-notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
