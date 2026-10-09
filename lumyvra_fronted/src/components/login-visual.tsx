"use client";
import { useEffect, useRef, useState } from "react";
import { useLandingMotion } from "./landing/landing-motion";
import type { SoundField } from "./landing/sound-field";

export function LoginVisual() {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<SoundField | null>(null);
  const [ready, setReady] = useState(false);
  const { paused } = useLandingMotion();
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    import("./landing/sound-field").then(({ createSoundField }) => {
      if (disposed) return;
      try {
        field.current = createSoundField(el, () => {
          if (!disposed) setReady(false);
        }, "login");
        setReady(true);
      } catch {
        setReady(false);
      }
    }).catch(() => { if (!disposed) setReady(false); });
    return () => {
      disposed = true;
      field.current?.dispose();
      field.current = null;
    };
  }, []);
  useEffect(() => { field.current?.setPaused(paused); }, [paused, ready]);
  return <div className={`login-visual ${ready ? "is-ready" : ""}`} aria-hidden="true">
    <div className="login-visual-fallback" />
    <div ref={host} className="login-particle-surface" />
  </div>;
}
