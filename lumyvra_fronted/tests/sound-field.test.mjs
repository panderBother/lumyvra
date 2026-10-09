import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";

// Exercise the real event/animation lifecycle without a browser or GPU.
// Renderer is mocked; this does not validate shader compilation or appearance.
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/components/landing/sound-field.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

function setup(width = 900, height = 650) {
  const frames = new Map();
  let nextId = 0,
    stamp = 100,
    rendered = null;
  const renderer = { disposed: false };
  const host = new EventTarget();
  const document = new EventTarget();
  const media = new EventTarget();
  document.hidden = false;
  media.matches = false;
  host.clientWidth = width;
  host.clientHeight = height;
  host.dataset = {};
  host.getBoundingClientRect = () => ({ left: 120, top: 80, width, height });
  host.appendChild = () => {};
  host.removeAttribute = () => {
    delete host.dataset.dragging;
  };
  const captured = new Set();
  host.hasPointerCapture = (id) => captured.has(id);
  host.setPointerCapture = (id) => captured.add(id);
  host.releasePointerCapture = (id) => captured.delete(id);
  class Renderer {
    constructor() {
      this.domElement = new EventTarget();
      this.domElement.remove = () => {};
      this.debug = {};
    }
    setClearColor() {}
    setPixelRatio(value) {
      this.ratio = value;
    }
    getPixelRatio() {
      return this.ratio;
    }
    setSize() {}
    render(scene) {
      rendered = scene.children[0];
    }
    dispose() {
      renderer.disposed = true;
    }
    forceContextLoss() {}
  }
  class Observer {
    observe() {}
    disconnect() {}
  }
  const exports = {};
  runInNewContext(source, {
    exports,
    require: () => ({ ...THREE, WebGLRenderer: Renderer }),
    window: { devicePixelRatio: 2, matchMedia: () => media },
    navigator: { hardwareConcurrency: 8 },
    document,
    IntersectionObserver: Observer,
    ResizeObserver: Observer,
    requestAnimationFrame: (fn) => {
      frames.set(++nextId, fn);
      return nextId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const field = exports.createSoundField(host, () => {});
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      stamp += 16;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn(stamp));
    }
  };
  tick();
  const pointer = (type, x = 0.5, y = 0.5, extra = {}) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: 120 + x * width,
      clientY: 80 + y * height,
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      ...extra,
    });
    host.dispatchEvent(event);
  };
  return {
    field,
    host,
    document,
    media,
    frames,
    tick,
    pointer,
    renderer,
    uniforms: rendered.material.uniforms,
  };
}

test("cursor stays aligned on wide and tall canvases and force recovers after leaving", () => {
  for (const [width, height] of [
    [900, 650],
    [390, 430],
    [1600, 700],
  ]) {
    const s = setup(width, height);
    s.pointer("pointerenter", 0.75, 0.25);
    s.tick(30);
    assert.ok(
      Math.abs(s.uniforms.uPointer.value.x - (0.5 * width) / height) < 1e-6,
    );
    assert.equal(s.uniforms.uPointer.value.y, 0.5);
    assert.ok(s.uniforms.uInfluence.value > 0.95);
    s.pointer("pointerleave");
    s.tick(60);
    assert.ok(s.uniforms.uInfluence.value < 0.001);
    s.field.dispose();
  }
});

test("click starts a wave in the empty centre; dragging strengthens interaction; cancellation releases it", () => {
  const s = setup();
  s.pointer("pointerdown");
  assert.equal(s.uniforms.uBurstAge.value, 0);
  assert.equal(s.uniforms.uBurstOrigin.value.length(), 0);
  assert.ok(s.host.hasPointerCapture(1));
  s.pointer("pointermove", 0.7, 0.4);
  s.tick(25);
  assert.ok(s.uniforms.uInfluence.value > 1.5);
  assert.ok(s.uniforms.uBurstAge.value > 0);
  s.pointer("pointercancel");
  s.tick(60);
  assert.equal(s.host.hasPointerCapture(1), false);
  assert.ok(s.uniforms.uInfluence.value < 0.001);
  s.field.dispose();
});

test("pause and reduced-motion stop interaction and continuous rendering", () => {
  const s = setup();
  s.field.setPaused(true);
  s.tick();
  s.pointer("pointerdown");
  assert.equal(s.uniforms.uBurstAge.value, 10);
  assert.equal(s.frames.size, 0);
  s.field.setPaused(false);
  s.tick(2);
  s.pointer("pointerdown");
  assert.equal(s.uniforms.uBurstAge.value, 0);
  s.media.matches = true;
  s.media.dispatchEvent(new Event("change"));
  s.tick();
  assert.equal(s.frames.size, 0);
  assert.equal(s.uniforms.uInfluence.value, 0);
  s.pointer("pointerdown");
  assert.equal(s.uniforms.uBurstAge.value, 10);
  s.field.dispose();
});

test("hidden tabs stop rendering; disposal removes pointer handlers and releases resources", () => {
  const s = setup();
  s.pointer("pointerdown");
  s.document.hidden = true;
  s.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(s.frames.size, 0);
  assert.equal(s.host.hasPointerCapture(1), false);
  s.document.hidden = false;
  s.document.dispatchEvent(new Event("visibilitychange"));
  s.tick(2);
  assert.equal(s.frames.size, 1);
  s.field.dispose();
  const age = s.uniforms.uBurstAge.value;
  s.pointer("pointerdown");
  assert.equal(s.uniforms.uBurstAge.value, age);
  assert.equal(s.frames.size, 0);
  assert.ok(s.renderer.disposed);
});
