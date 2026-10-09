import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/components/landing/particle-field.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function setup(variant = "stars", reduced = false, width = 1200) {
  const frames = new Map();
  let nextId = 0, stamp = 100;
  const counts = { lights: 0, rings: 0, clears: 0, pixels: 0, meteors: 0 };
  class Element extends EventTarget {
    control = false;
    typing = false;
    closest(selector) {
      if (this.typing && selector.includes("input")) return this;
      return this.control && selector.includes("a,button") ? this : null;
    }
  }
  const host = new Element();
  host.clientWidth = width; host.clientHeight = 650;
  host.getBoundingClientRect = () => ({ left: 100, top: 50 });
  const context = {
    clearRect() { counts.clears++; counts.lights = 0; counts.rings = 0; counts.pixels = 0; counts.meteors = 0; },
    drawImage(_image, _x, _y, size) { counts.lights++; if (size === 17) counts.meteors++; },
    fillRect() { counts.pixels++; },
    arc() { counts.rings++; },
    setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    createRadialGradient() { return { addColorStop() {} }; },
  };
  const canvas = { parentElement: host, getContext: () => context };
  const document = new EventTarget();
  document.hidden = false;
  document.createElement = () => ({ getContext: () => ({ ...context, fillRect() {} }) });
  const media = new EventTarget();
  media.matches = reduced;
  const intersection = { callback: null, disconnected: false };
  const resize = { callback: null, disconnected: false };
  class IntersectionObserver {
    constructor(callback) { intersection.callback = callback; }
    observe() {}
    disconnect() { intersection.disconnected = true; }
  }
  class ResizeObserver {
    constructor(callback) { resize.callback = callback; }
    observe() {}
    disconnect() { resize.disconnected = true; }
  }
  const exports = {};
  runInNewContext(source, {
    exports, Element, document, IntersectionObserver, ResizeObserver,
    window: { matchMedia: () => media, devicePixelRatio: 3 },
    requestAnimationFrame(fn) { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const field = exports.createParticleField(canvas, variant);
  const intersect = (visible) => intersection.callback([{ isIntersecting: visible }]);
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      stamp += 34;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach((fn) => fn(stamp));
    }
  };
  const pointer = (type) => {
    const event = new Event(type);
    Object.assign(event, { clientX: 450, clientY: 350, button: 0 });
    host.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, "decorations never block scrolling or links");
  };
  return { field, host, canvas, counts, frames, document, media, intersection, resize, intersect, tick, pointer };
}

test("only visible unpaused sections animate; unmount releases all observers and events", () => {
  const s = setup();
  assert.equal(s.frames.size, 0);
  assert.equal(s.canvas.width, 1800, "DPR is capped at 1.5");
  s.intersect(true); s.tick();
  assert.equal(s.frames.size, 1);
  s.field.setPaused(true);
  const frozen = s.counts.clears;
  s.pointer("pointerdown"); s.tick(3);
  assert.equal(s.counts.clears, frozen);
  s.field.setPaused(false); assert.equal(s.frames.size, 1);
  s.document.hidden = true; s.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(s.frames.size, 0);
  s.document.hidden = false; s.document.dispatchEvent(new Event("visibilitychange"));
  s.intersect(false); assert.equal(s.frames.size, 0);
  s.intersect(true); s.field.dispose();
  assert.equal(s.frames.size, 0);
  assert.ok(s.intersection.disconnected && s.resize.disconnected);
  const cleared = s.counts.clears;
  s.pointer("pointermove"); s.document.dispatchEvent(new Event("visibilitychange")); s.tick();
  assert.equal(s.counts.clears, cleared);
});

test("reduced motion renders a static composition and responds to preference changes", () => {
  const s = setup("waves", true);
  assert.ok(s.counts.pixels > 1000);
  s.intersect(true); s.pointer("pointerdown"); s.tick();
  assert.equal(s.frames.size, 0);
  s.media.matches = false; s.media.dispatchEvent(new Event("change"));
  assert.equal(s.frames.size, 1);
  s.tick(); s.pointer("pointerdown"); s.tick(); assert.equal(s.counts.rings, 1);
  s.media.matches = true; s.media.dispatchEvent(new Event("change"));
  assert.equal(s.frames.size, 0); assert.equal(s.counts.rings, 0);
  s.field.dispose();
});

test("clicks produce bounded, expiring bursts while form controls produce none", () => {
  const s = setup(); s.intersect(true); s.tick();
  s.host.control = true; s.pointer("pointerdown"); s.tick();
  assert.equal(s.counts.rings, 0);
  s.host.control = false; s.pointer("pointerdown"); s.tick();
  assert.equal(s.counts.rings, 1);
  for (let i = 0; i < 100; i++) s.pointer("pointerdown");
  s.tick(); assert.equal(s.counts.rings, 4);
  assert.ok(s.counts.lights <= 431, "spark buffers remain capped during rapid interaction");
  s.tick(65); assert.equal(s.counts.rings, 0);
  assert.ok(s.counts.lights <= 281, "temporary sparks expire");
  s.field.dispose();
});

test("mobile fields reduce density and remain functional after resize", () => {
  const s = setup("waves", false, 390);
  assert.equal(s.counts.pixels, 1000);
  s.host.clientWidth = 1200; s.resize.callback();
  assert.equal(s.counts.pixels, 2880);
  s.intersect(true); s.tick(); s.pointer("pointermove"); s.tick(2);
  assert.ok(s.counts.lights > 230);
  s.pointer("pointercancel"); s.field.dispose();
});

test("cover links show hover trails while inputs suppress them and clicks keep control behavior", () => {
  const s = setup(); s.intersect(true); s.tick();
  const ambient = s.counts.lights;
  s.host.control = true;
  s.pointer("pointermove"); s.tick(2);
  assert.ok(s.counts.lights > ambient, "hovering a cover link must emit a trail");
  s.pointer("pointerdown"); s.tick();
  assert.equal(s.counts.rings, 0, "control click is not turned into a decorative burst");
  s.pointer("pointerleave"); s.tick(65);
  s.host.typing = true;
  const inputBaseline = s.counts.lights;
  s.pointer("pointermove"); s.tick(2);
  assert.equal(s.counts.lights, inputBaseline, "typing surfaces have no trail");
  s.field.dispose();
});

test("every section variant includes meteor streaks, not just the hero", () => {
  for (const variant of ["stars", "embers", "waves"]) {
    const s = setup(variant); s.intersect(true); s.tick(2);
    assert.ok(s.counts.meteors > 0, `${variant} has a visible meteor`);
    s.field.dispose();
  }
});
