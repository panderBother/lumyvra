"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, PenLine, Pause, Play, MousePointer2 } from "lucide-react";

type Particle = { angle: number; band: number; size: number; offsetX: number; offsetY: number; vx: number; vy: number };
type Ripple = { x: number; y: number; age: number };
type Spark = { x: number; y: number; vx: number; vy: number; age: number; glyph: string };

export function GenerationParticles({ words = false, active = true }: { words?: boolean; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const interact = useRef<(x: number, y: number) => void>(() => {});
  const [paused, setPaused] = useState(false);
  const [bursts, setBursts] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !button || !context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const palette = getComputedStyle(button);
    const accent = palette.getPropertyValue("--acid").trim() || "#e0f298";
    const muted = palette.getPropertyValue("--muted").trim() || "#a1aa95";
    const particles: Particle[] = Array.from({ length: 168 }, (_, i) => ({
      angle: i * 2.399963, band: (i % 7) / 6, size: i % 13 === 0 ? 2.7 : 1.1 + (i % 3) * .35,
      offsetX: 0, offsetY: 0, vx: 0, vy: 0,
    }));
    let width = 0, height = 0, frame = 0, lastFrame = 0, time = 0;
    let visible = true;
    let ripples: Ripple[] = [];
    let sparks: Spark[] = [];
    let pointer: { x: number; y: number } | null = null;
    const moving = () => active && !paused && !reducedMotion.matches && !document.hidden && visible;

    function position(particle: Particle) {
      const radius = Math.min(width * .36, height * .44) * (.48 + particle.band * .55);
      const angle = particle.angle + time * (.13 + particle.band * .07) * (particle.band > .5 ? 1 : -1);
      // Lyrics form an open ribbon; songs orbit a shared musical centre.
      return {
        x: width / 2 + Math.cos(angle) * radius * (words ? 1.15 : 1.08),
        y: height / 2 + Math.sin(angle) * radius * (words ? .55 : .82) + Math.sin(angle * 3 + time) * 12,
      };
    }

    function draw(delta: number) {
      context!.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width * .36, height * .44);
      const halo = context!.createRadialGradient(cx, cy, 8, cx, cy, radius * 1.25);
      halo.addColorStop(0, `${accent}18`);
      halo.addColorStop(1, `${accent}00`);
      context!.fillStyle = halo;
      context!.fillRect(0, 0, width, height);
      if (pointer && moving()) {
        const light = context!.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 85);
        light.addColorStop(0, `${accent}12`);
        light.addColorStop(1, `${accent}00`);
        context!.fillStyle = light;
        context!.fillRect(0, 0, width, height);
      }
      context!.strokeStyle = accent;
      context!.lineWidth = .7;
      for (let band = 0; band < 3; band++) {
        context!.globalAlpha = .08 + band * .025;
        context!.beginPath();
        context!.ellipse(cx, cy, radius * (.58 + band * .2) * 1.08, radius * (.58 + band * .2) * (words ? .55 : .82), -.15, time * .12 + band, time * .12 + band + Math.PI * 1.6);
        context!.stroke();
      }
      for (const particle of particles) {
        const point = position(particle);
        const dx = point.x + particle.offsetX - (pointer?.x ?? cx);
        const dy = point.y + particle.offsetY - (pointer?.y ?? cy);
        const distance = Math.hypot(dx, dy);
        if (moving() && pointer && distance < 80 && distance > 1) {
          const force = (1 - distance / 80) * 24 * delta;
          particle.vx += dx / distance * force;
          particle.vy += dy / distance * force;
        }
        particle.vx = (particle.vx - particle.offsetX * delta * 3) * Math.exp(-delta * 5);
        particle.vy = (particle.vy - particle.offsetY * delta * 3) * Math.exp(-delta * 5);
        particle.offsetX += particle.vx * delta * 30;
        particle.offsetY += particle.vy * delta * 30;
        context!.globalAlpha = .24 + (Math.sin(particle.angle + time * .8) + 1) * .28;
        context!.fillStyle = particle.size > 2 ? accent : muted;
        context!.beginPath();
        context!.arc(point.x + particle.offsetX, point.y + particle.offsetY, particle.size, 0, Math.PI * 2);
        context!.fill();
      }
      for (const ripple of ripples) {
        ripple.age += delta;
        context!.globalAlpha = Math.max(0, 1 - ripple.age / 1.4) * .5;
        context!.strokeStyle = accent;
        context!.lineWidth = 1;
        context!.beginPath();
        context!.arc(ripple.x, ripple.y, 10 + ripple.age * 150, 0, Math.PI * 2);
        context!.stroke();
      }
      ripples = ripples.filter(ripple => ripple.age < 1.4);
      context!.font = `18px ${palette.fontFamily}`;
      context!.fillStyle = accent;
      for (const spark of sparks) {
        spark.age += delta;
        spark.x += spark.vx * delta;
        spark.y += spark.vy * delta;
        spark.vy += 28 * delta;
        context!.globalAlpha = Math.max(0, 1 - spark.age / 1.5) * .8;
        context!.fillText(spark.glyph, spark.x, spark.y);
      }
      sparks = sparks.filter(spark => spark.age < 1.5);
      context!.globalAlpha = 1;
    }

    function tick(timestamp: number) {
      frame = 0;
      if (!moving()) return;
      if (timestamp - lastFrame >= 1000 / 30) {
        const delta = Math.min((timestamp - lastFrame) / 1000, .05);
        lastFrame = timestamp;
        time += delta;
        draw(delta);
      }
      frame = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = performance.now();
      if (moving()) frame = requestAnimationFrame(tick);
      else draw(0);
    }
    function resize() {
      const rect = button!.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    }
    function pointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" || !active) return;
      const rect = button!.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function pointerLeave() { pointer = null; }
    interact.current = (x, y) => {
      if (!active) return;
      if (!moving()) {
        // A quiet, immediate response also works with reduced motion or pause.
        time += .3;
        draw(0);
        return;
      }
      ripples = [...ripples.slice(-4), { x, y, age: 0 }];
      const glyphs = words ? ["词", "句", "韵"] : ["♪", "♫", "♪"];
      sparks = [...sparks.slice(-18), ...glyphs.map((glyph, i) => ({ x, y, age: 0, glyph, vx: (i - 1) * 45, vy: -38 - i * 12 }))];
      for (const particle of particles) {
        const point = position(particle);
        const dx = point.x - x, dy = point.y - y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = Math.max(0, 1 - distance / 260) * 20;
        particle.vx = Math.max(-60, Math.min(60, particle.vx + dx / distance * force));
        particle.vy = Math.max(-60, Math.min(60, particle.vy + dy / distance * force));
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(button);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      resume();
    });
    intersection.observe(button);
    button.addEventListener("pointermove", pointerMove);
    button.addEventListener("pointerleave", pointerLeave);
    document.addEventListener("visibilitychange", resume);
    reducedMotion.addEventListener("change", resume);
    resize(); resume();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      button.removeEventListener("pointermove", pointerMove);
      button.removeEventListener("pointerleave", pointerLeave);
      document.removeEventListener("visibilitychange", resume);
      reducedMotion.removeEventListener("change", resume);
      interact.current = () => {};
    };
  }, [words, active, paused]);

  const Icon = words ? PenLine : Music2;
  return <div className={`generation-playground${words ? " is-lyrics" : ""}`}>
    <button ref={buttonRef} className="particle-surface" type="button" disabled={!active}
      aria-label={words ? "点亮歌词灵感粒子，点击或按回车互动" : "拨动音乐灵感粒子，点击或按回车互动"}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        interact.current(event.detail === 0 ? rect.width / 2 : event.clientX - rect.left, event.detail === 0 ? rect.height / 2 : event.clientY - rect.top);
        setBursts(value => value + 1);
      }}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="particle-core" aria-hidden="true"><Icon size={36} strokeWidth={1.4} /><span>{words ? "写下此刻" : "酝酿旋律"}</span></span>
    </button>
    <div className="particle-toolbar">
      <span><MousePointer2 size={13} aria-hidden="true" /> {active ? "移动聚光 · 点击散开" : "灵感暂歇，草稿仍在"}</span>
      {active && <button type="button" className="generation-motion-toggle" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={13} /> : <Pause size={13} />}{paused ? "继续动画" : "暂停动画"}
      </button>}
    </div>
    <span className="visually-hidden" role="status">{bursts ? `已点亮 ${bursts} 次灵感，生成任务不受影响。` : "粒子互动不影响生成任务。"}</span>
  </div>;
}
