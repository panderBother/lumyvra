export type ParticleVariant = "stars" | "embers" | "waves";
export type ParticleField = { setPaused: (value: boolean) => void; dispose: () => void };

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Ripple = { x: number; y: number; age: number };
const TAU = Math.PI * 2;

/** Decorative section-local canvas. Events stay on the section, leaving links and scrolling intact. */
export function createParticleField(canvas: HTMLCanvasElement, variant: ParticleVariant): ParticleField {
  const ctx = canvas.getContext("2d", { alpha: true });
  const host = canvas.parentElement;
  if (!ctx || !host) return { setPaused() {}, dispose() {} };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const glow = document.createElement("canvas");
  glow.width = glow.height = 48;
  const glowCtx = glow.getContext("2d");
  if (glowCtx) {
    const gradient = glowCtx.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, "#ffffe9");
    gradient.addColorStop(0.12, "#ecffb4e0");
    gradient.addColorStop(0.4, "#d4ed7e45");
    gradient.addColorStop(1, "#d4ed7e00");
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 48, 48);
  }
  // Fixed seeds avoid visual jumps on resize; only the number drawn changes.
  let seed = 1493;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const dots = Array.from({ length: 300 }, () => ({
    x: random(), y: random(), depth: random(), phase: random() * TAU,
  }));
  let width = 1, height = 1, small = false;
  let raf = 0, last = 0, time = 0, paused = false, visible = false, disposed = false;
  let pointerX = -1000, pointerY = -1000, pointerActive = false, trailBudget = 0;
  const sparks: Spark[] = [], ripples: Ripple[] = [];
  const canAnimate = () => !disposed && visible && !paused && !media.matches && !document.hidden;
  const isControl = (event: PointerEvent) => event.target instanceof Element &&
    Boolean(event.target.closest("a,button,input,textarea,select,[role=button]"));
  const isTyping = (event: PointerEvent) => event.target instanceof Element &&
    Boolean(event.target.closest("input,textarea,select,[contenteditable=true]"));
  const position = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    pointerActive = true;
  };
  const addSparks = (count: number, burst: boolean) => {
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU, speed = burst ? 70 + random() * 200 : 12 + random() * 32;
      const life = burst ? 0.7 + random() * 0.9 : 0.35 + random() * 0.55;
      sparks.push({ x: pointerX, y: pointerY, vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed, life, max: life, size: burst ? 9 + random() * 14 : 7 + random() * 11 });
    }
    // Pointer hardware can send hundreds of events per second.
    if (sparks.length > 150) sparks.splice(0, sparks.length - 150);
  };
  const move = (event: PointerEvent) => {
    // Covers and links should have the same hover trail as empty space.
    // Only text editing surfaces suppress the decoration; clicks retain normal control behavior.
    if (!canAnimate() || isTyping(event)) { pointerActive = false; trailBudget = 0; return; }
    position(event);
    trailBudget = 0.1;
  };
  const press = (event: PointerEvent) => {
    if (!canAnimate() || isControl(event) || event.button !== 0) return;
    position(event);
    addSparks(small ? 28 : 52, true);
    ripples.push({ x: pointerX, y: pointerY, age: 0 });
    if (ripples.length > 4) ripples.shift();
  };
  const leave = () => { pointerActive = false; trailBudget = 0; };
  const release = (event: PointerEvent) => { if (event.pointerType !== "mouse") leave(); };

  const light = (x: number, y: number, size: number, alpha: number) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(glow, x - size / 2, y - size / 2, size, size);
  };
  const draw = (dt: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    // Match density to section area instead of crowding short strips with a full hero's stars.
    const count = Math.min(small ? 110 : 300, Math.max(28, Math.round(width * height / (small ? 4200 : 4800))));
    for (let i = 0; i < count; i++) {
      const p = dots[i];
      const speed = variant === "embers" ? 9 + p.depth * 21 : 2 + p.depth * 6;
      let x = (p.x * width + Math.sin(time * 0.15 + p.phase) * 22 + width) % width;
      let y = ((p.y * height - time * speed) % height + height) % height;
      if (pointerActive) {
        const dx = x - pointerX, dy = y - pointerY, distance = Math.hypot(dx, dy);
        const force = Math.max(0, 1 - distance / 145) * 35;
        x += dx / Math.max(1, distance) * force;
        y += dy / Math.max(1, distance) * force;
      }
      const twinkle = 0.57 + Math.sin(time * (0.6 + p.depth) + p.phase) * 0.23;
      const size = variant === "embers" ? 7 + p.depth * 15 : 4 + p.depth * 12;
      light(x, y, size, twinkle * (variant === "waves" ? 0.65 : 1));
      if (p.depth > 0.93) {
        ctx.globalAlpha = twinkle * 0.5;
        ctx.strokeStyle = "#e7f8b5";
        ctx.lineWidth = 0.65;
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
      }
    }

    {
      // Shared by every section, including inspiration covers and the closing wave field.
      for (let i = 0; i < 3; i++) {
        const phase = (time * 0.16 + i * 0.33 + 0.07) % 1;
        if (phase > 0.27) continue;
        const progress = phase / 0.27;
        const x = width * (0.35 + i * 0.23) - progress * width * 0.23;
        const y = height * (0.04 + i * 0.14) + progress * height * 0.28;
        const alpha = Math.sin(progress * Math.PI) * 0.7;
        for (let j = 0; j < 16; j++) light(x + j * 4, y - j * 2, 5 - j * 0.18, alpha * (1 - j / 16));
        light(x, y, 17, alpha);
      }
    }

    if (variant === "waves") {
      const columns = small ? 100 : 180, rows = small ? 10 : 16;
      ctx.fillStyle = "#e1f2a3";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const u = col / (columns - 1), v = row / (rows - 1);
          const x = u * (width + 50) - 25;
          let y = height * 0.66 + Math.sin(u * 8.5 + time * 0.48 + v * 1.9) * height * 0.13 +
            Math.cos(u * 5.2 - time * 0.3 + v) * height * 0.05 + (v - 0.5) * height * 0.24;
          if (pointerActive) {
            const influence = Math.exp(-((x - pointerX) ** 2) / 27000);
            y += influence * (pointerY - height * 0.65) * 0.23;
          }
          for (const ring of ripples) {
            const distance = Math.hypot(x - ring.x, y - ring.y);
            y += Math.sin(distance * 0.025 - ring.age * 9) * 25 *
              Math.exp(-Math.abs(distance - ring.age * 300) / 100) * (1 - ring.age / 1.8);
          }
          const edge = Math.pow(Math.abs(u - 0.5) * 2, 0.55);
          ctx.globalAlpha = (0.13 + edge * 0.52) * (0.5 + Math.sin(v * Math.PI) * 0.5);
          const size = 0.8 + v * 0.85;
          ctx.fillRect(x, y, size, size);
          if (row % 5 === 0 && col % 9 === 0) light(x, y, 8, 0.25 + edge * 0.3);
        }
      }
    }

    if (dt && pointerActive && trailBudget > 0) {
      addSparks(small ? 1 : 2, false);
      trailBudget -= dt;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 14 * dt;
      light(p.x, p.y, p.size * (0.4 + p.life / p.max * 0.6), p.life / p.max);
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const ring = ripples[i];
      ring.age += dt;
      if (ring.age >= 1.8) { ripples.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - ring.age / 1.8) * 0.3;
      ctx.strokeStyle = "#e0f298"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.age * 190 + 4, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const frame = (stamp: number) => {
    raf = 0;
    if (!canAnimate()) return;
    // Limit these decorative layers to 30 fps, leaving GPU headroom for the Three.js hero.
    if (!last || stamp - last >= 32) {
      const dt = last ? Math.min((stamp - last) / 1000, 0.05) : 0;
      last = stamp; time += dt; draw(dt);
    }
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
    if (canAnimate()) raf = requestAnimationFrame(frame);
    else leave();
  };
  const resize = () => {
    if (disposed) return;
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    small = width < 760;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(0);
  };
  const onVisibility = () => sync();
  const onPreference = () => { sparks.length = 0; ripples.length = 0; sync(); draw(0); };
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting; sync();
  }, { threshold: 0 });
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerdown", press, { passive: true });
  host.addEventListener("pointerleave", leave);
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", leave);
  document.addEventListener("visibilitychange", onVisibility);
  media.addEventListener("change", onPreference);
  resizeObserver.observe(host); intersectionObserver.observe(host); resize();
  return {
    setPaused(value) { paused = value; sync(); },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerdown", press);
      host.removeEventListener("pointerleave", leave); host.removeEventListener("pointercancel", leave);
      host.removeEventListener("pointerup", release);
      document.removeEventListener("visibilitychange", onVisibility); media.removeEventListener("change", onPreference);
      sparks.length = 0; ripples.length = 0;
      ctx.clearRect(0, 0, width, height);
    },
  };
}
