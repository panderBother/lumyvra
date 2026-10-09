import * as THREE from "three";
export type SoundField = {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  setAnalyser: (node: AnalyserNode | null) => void;
};
/** Shader-deformed sound sculpture, rendered at native canvas resolution. */
export function createSoundField(
  host: HTMLDivElement,
  onLost: () => void,
  variant: "hero" | "login" = "hero",
): SoundField {
  const login = variant === "login";
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(39, 1, 0.1, 30);
  camera.position.z = 7.6;
  const mobile = host.clientWidth < 600 || navigator.hardwareConcurrency <= 4,
    around = mobile ? 250 : 420,
    across = mobile ? 54 : login ? 58 : 88,
    count = around * across;
  const positions = new Float32Array(count * 3),
    coords = new Float32Array(count * 2);
  for (let i = 0; i < around; i++)
    for (let j = 0; j < across; j++) {
      const k = i * across + j;
      coords[k * 2] = (i / around) * Math.PI * 2;
      coords[k * 2 + 1] = (j / across) * Math.PI * 2;
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aCoord", new THREE.BufferAttribute(coords, 2));
  const uniforms = {
    uTime: { value: 0 },
    uLogin: { value: login ? 1 : 0 },
    uEnergy: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uAspect: { value: 1 },
    uPointer: { value: new THREE.Vector2() },
    uInfluence: { value: 0 },
    uSpeed: { value: 0 },
    uBurstOrigin: { value: new THREE.Vector2() },
    uBurstAge: { value: 10 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec2 aCoord;
      uniform float uTime, uEnergy, uPixelRatio, uAspect, uLogin;
      uniform vec2 uPointer, uBurstOrigin;
      uniform float uInfluence, uSpeed, uBurstAge;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float u = aCoord.x, v = aCoord.y, t = uTime * .21;
        float wave = sin(u * 3.0 + t) * .12 + sin(u * 7.0 - t * .7) * .035;
        float tube = .47 + .09 * sin(u * 4.0 - t) + uEnergy * .22;
        float r = 1.68 + wave + cos(v) * tube;
        vec3 p = vec3(r * cos(u), r * sin(u), sin(v) * tube * .9);
        p.z += .19 * sin(u * 3.0 + t * .8);
        // The login ribbon follows the original film's folded silhouette.
        if (uLogin > .5) {
          float radius = 2.12 + .30 * sin(3.0 * u + t) + .13 * cos(5.0 * u - 2.0 * t);
          float ribbon = .56 + .11 * sin(2.0 * u - t);
          p = vec3((radius + ribbon * cos(v)) * cos(u), (radius + ribbon * cos(v)) * sin(u), ribbon * sin(v) + .4 * sin(2.0 * u + t));
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 clip = projectionMatrix * mv;

        // Work in screen space so the force stays under the actual cursor,
        // regardless of the sculpture's rotation or the canvas aspect ratio.
        vec2 screen = clip.xy / clip.w * vec2(uAspect, 1.0);
        vec2 delta = screen - uPointer;
        float distance = length(delta);
        vec2 direction = delta / max(distance, .001);
        float reach = .43 + uSpeed * .1;
        float influence = exp(-pow(distance / reach, 2.0) * 2.0) * uInfluence;
        vec2 scatter = vec2(sin(u * 127.1 + v * 311.7), cos(v * 173.3 - u * 269.5));
        vec2 offset = direction * influence * (.27 + .13 * uSpeed);
        offset += scatter * influence * (.025 + .055 * uSpeed);

        // A click sends an expanding impulse through the entire ring,
        // including clicks in its empty centre. It decays back to the base shape.
        vec2 burstDelta = screen - uBurstOrigin;
        float burstDistance = length(burstDelta);
        float wavefront = burstDistance - uBurstAge * 1.65;
        float pulse = exp(-wavefront * wavefront / .032) * exp(-uBurstAge * 1.4);
        offset += (burstDelta / max(burstDistance, .001) * .46 + scatter * .12) * pulse;
        clip.xy += offset / vec2(uAspect, 1.0) * clip.w;

        float highlight = pow(.5 + .5 * sin(v + u * 1.5 + t * .25), 3.0);
        vColor = mix(vec3(.29,.34,.28), vec3(.88,.96,.66), highlight);
        float silver = smoothstep(.2,.9,sin(u+1.5));
        vColor = mix(vColor, vec3(.78,.84,.78), silver * .58);
        if (uLogin > .5) vColor = mix(vec3(.28,.33,.14), vec3(.86,.94,.51), highlight);
        vColor = mix(vColor, vec3(.9, 1.0, .67), min(influence * .35 + pulse * .6, .8));
        vAlpha = min(.30 + .65 * highlight + influence * .16 + pulse * .28, 1.0);
        gl_PointSize = clamp((1.55 + highlight * .7 + influence * .35) * uPixelRatio * 5.0 / -mv.z, 1.0, 4.0);
        gl_Position = clip;
      }`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float edge=1.0-smoothstep(.15,.5,d);gl_FragColor=vec4(vColor,edge*vAlpha);}`,
  });
  const sculpture = new THREE.Points(geometry, material);
  sculpture.frustumCulled = false;
  sculpture.rotation.set(0.52, -0.34, -0.4);
  if (login) {
    sculpture.rotation.set(.6, 0, .14);
    sculpture.position.y = .5;
  }
  scene.add(sculpture);
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches,
    paused = false,
    visible = true,
    disposed = false,
    lost = false,
    frame = 0,
    last = 0,
    time = 0,
    pointerX = 0,
    pointerY = 0;
  const targetPointer = new THREE.Vector2();
  let pointerInside = false,
    dragging = false,
    pointerId: number | null = null,
    pointerStamp = 0,
    speed = 0;
  let analyser: AnalyserNode | null = null;
  const bins = new Uint8Array(32);
  const draw = (stamp: number) => {
    frame = 0;
    if (disposed || lost) return;
    const dt = last ? Math.min((stamp - last) / 1000, 0.05) : 0;
    last = stamp;
    if (!paused && !reduced) {
      // Contact slows the idle motion; releasing lets it smoothly recover.
      time += dt * (1 - uniforms.uInfluence.value * 0.45);
      const ease = 1 - Math.exp(-dt * 12);
      uniforms.uPointer.value.lerp(targetPointer, 1 - Math.exp(-dt * 24));
      uniforms.uInfluence.value +=
        ((pointerInside ? (dragging ? 1.65 : 1) : 0) -
          uniforms.uInfluence.value) *
        ease;
      uniforms.uSpeed.value += (speed - uniforms.uSpeed.value) * ease;
      speed *= Math.exp(-dt * 8);
      uniforms.uBurstAge.value = Math.min(10, uniforms.uBurstAge.value + dt);
    }
    uniforms.uTime.value = time;
    if (analyser && !paused && !reduced) {
      analyser.getByteFrequencyData(bins);
      const energy = bins.reduce((a, b) => a + b, 0) / bins.length / 255;
      uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * 0.1;
    } else {
      uniforms.uEnergy.value *= 0.92;
    }
    if (!paused && !reduced) {
      sculpture.rotation.y +=
        (-0.34 +
          pointerX * 0.22 +
          Math.sin(time * 0.13) * 0.13 -
          sculpture.rotation.y) *
        0.035;
      sculpture.rotation.x +=
        (0.52 + pointerY * 0.14 - sculpture.rotation.x) * 0.035;
      sculpture.rotation.z = -0.4 + Math.sin(time * 0.08) * 0.09;
      if (login) {
        sculpture.rotation.x = .6 + .13 * Math.sin(time * .21) + pointerY * .12;
        sculpture.rotation.y = pointerX * .12;
        sculpture.rotation.z = .14 + .24 * Math.sin(time * .21);
      }
    }
    renderer.render(scene, camera);
    if (visible && !document.hidden && !paused && !reduced && !lost)
      frame = requestAnimationFrame(draw);
  };
  const refresh = () => {
    cancelAnimationFrame(frame);
    last = 0;
    if (visible && !document.hidden && !disposed && !lost)
      frame = requestAnimationFrame(draw);
  };
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    if (login) camera.position.z = Math.max(7.2, 7.2 / camera.aspect);
    uniforms.uAspect.value = w / h;
    camera.updateProjectionMatrix();
    refresh();
  };
  const pointer = (event: PointerEvent) => {
    if (paused || reduced || !event.isPrimary) return;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (event.clientX - r.left) / r.width,
      y = (event.clientY - r.top) / r.height;
    const wasInside = pointerInside;
    pointerInside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    pointerX = x - 0.5;
    pointerY = y - 0.5;
    const sx = ((x * 2 - 1) * r.width) / r.height,
      sy = 1 - y * 2;
    if (pointerStamp && wasInside) {
      const elapsed = Math.max((event.timeStamp - pointerStamp) / 1000, 0.008);
      speed = Math.min(
        2,
        (Math.hypot(sx - targetPointer.x, sy - targetPointer.y) / elapsed) *
          0.15,
      );
    }
    targetPointer.set(sx, sy);
    if (!wasInside) uniforms.uPointer.value.copy(targetPointer);
    pointerStamp = event.timeStamp;
  };
  const leave = () => {
    pointerInside = false;
    pointerStamp = 0;
    pointerX = 0;
    pointerY = 0;
  };
  const release = () => {
    dragging = false;
    host.removeAttribute("data-dragging");
    const capturedId = pointerId;
    pointerId = null;
    if (capturedId !== null && host.hasPointerCapture(capturedId))
      host.releasePointerCapture(capturedId);
  };
  const press = (event: PointerEvent) => {
    if (paused || reduced || !event.isPrimary || event.button !== 0) return;
    pointer(event);
    if (!pointerInside) return;
    uniforms.uBurstOrigin.value.copy(targetPointer);
    uniforms.uBurstAge.value = 0;
    dragging = true;
    pointerId = event.pointerId;
    host.setPointerCapture(pointerId);
    host.dataset.dragging = "true";
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    release();
    if (event.pointerType !== "mouse") leave();
  };
  const cancel = () => {
    release();
    leave();
  };
  const preference = () => {
    reduced = media.matches;
    cancel();
    uniforms.uInfluence.value = 0;
    uniforms.uBurstAge.value = 10;
    refresh();
  };
  const visibility = () => {
    if (document.hidden) cancel();
    refresh();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    onLost();
  };
  renderer.debug.onShaderError = () => {
    lost = true;
    cancelAnimationFrame(frame);
    onLost();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      refresh();
    },
    { threshold: 0.01 },
  );
  const resizeObserver = new ResizeObserver(resize);
  observer.observe(host);
  resizeObserver.observe(host);
  host.addEventListener("pointermove", pointer);
  host.addEventListener("pointerenter", pointer);
  host.addEventListener("pointerdown", press);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", cancel);
  host.addEventListener("lostpointercapture", cancel);
  host.addEventListener("pointerleave", leave);
  media.addEventListener("change", preference);
  document.addEventListener("visibilitychange", visibility);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize();
  return {
    setPaused(value) {
      paused = value;
      host.dataset.paused = String(value);
      if (value) cancel();
      refresh();
    },
    setAnalyser(node) {
      analyser = node;
    },
    dispose() {
      disposed = true;
      cancel();
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", pointer);
      host.removeEventListener("pointerenter", pointer);
      host.removeEventListener("pointerdown", press);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", cancel);
      host.removeEventListener("lostpointercapture", cancel);
      host.removeEventListener("pointerleave", leave);
      media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
