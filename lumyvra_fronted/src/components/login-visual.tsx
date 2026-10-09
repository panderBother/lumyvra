"use client";
import { useEffect, useRef } from "react";
import { useLandingMotion } from "./landing/landing-motion";

export function LoginFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const { paused } = useLandingMotion();
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (paused || preference.matches || document.hidden) el.pause();
      else void el.play().catch(() => {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    return () => { el.pause(); document.removeEventListener("visibilitychange", sync); preference.removeEventListener("change", sync); };
  }, [paused]);
  return <video ref={video} className="login-film" muted loop playsInline preload="metadata"
    poster="/media/lumyvra-sound-bloom-poster.webp" aria-label="黄绿色声波粒子雕塑循环视频">
    <source src="/media/lumyvra-sound-bloom.mp4" type="video/mp4" />
  </video>;
}
