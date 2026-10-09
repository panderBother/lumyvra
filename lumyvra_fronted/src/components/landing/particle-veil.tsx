"use client";

import { useEffect, useRef } from "react";
import { createParticleField, type ParticleField, type ParticleVariant } from "./particle-field";
import { useLandingMotion } from "./landing-motion";

export function ParticleVeil({ variant = "stars" }: { variant?: ParticleVariant }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<ParticleField | null>(null);
  const { paused } = useLandingMotion();
  useEffect(() => {
    if (!canvas.current) return;
    field.current = createParticleField(canvas.current, variant);
    return () => { field.current?.dispose(); field.current = null; };
  }, [variant]);
  useEffect(() => { field.current?.setPaused(paused); }, [paused, variant]);
  return <canvas ref={canvas} className={`particle-veil particle-veil-${variant}`} aria-hidden="true" />;
}
