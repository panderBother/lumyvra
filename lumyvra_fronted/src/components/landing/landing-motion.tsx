"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

const MotionContext = createContext<{ paused: boolean; setPaused: (value: boolean) => void } | null>(null);

export function LandingMotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const value = useMemo(() => ({ paused, setPaused }), [paused]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useLandingMotion() {
  const motion = useContext(MotionContext);
  if (!motion) throw new Error("Landing motion requires its provider");
  return motion;
}

export function ParticleMotionToggle() {
  const { paused, setPaused } = useLandingMotion();
  return (
    <button className="particle-motion-toggle" onClick={() => setPaused(!paused)} aria-pressed={paused}>
      {paused ? <Play size={14} /> : <Pause size={14} />}
      {paused ? "继续页面动效" : "暂停页面动效"}
    </button>
  );
}
