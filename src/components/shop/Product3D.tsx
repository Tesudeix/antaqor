"use client";

import { useEffect, useRef } from "react";
import type { BufferGeometry, NormalBufferAttributes, Material, MeshPhysicalMaterial, MeshBasicMaterial, Color as TColor, Mesh as TMesh, Group } from "three";

/* ─── ANTAQOR SUPPLY — 3D (2026-10-16) ───────────────────────────────────
   `model` (.glb) өгвөл жинхэнэ загварыг ачаална; өгөөгүй бол `kind`-аар
   код дээр бүтээсэн загвар (hoodie / cap / tee). `buildModel` нэг л газар —
   hero (амьд, эргэдэг) болон картын зураг (`renderThumb`, нэг удаа
   зураад PNG) хоёул үүнийг ашиглана, тиймээс карт hero-тэй яг ижил харагдана.
   three.js зөвхөн энд динамикаар импортлогдоно. */

type Three = typeof import("three");
type Kit = { THREE: Three; RoundedBoxGeometry: typeof import("three/examples/jsm/geometries/RoundedBoxGeometry.js").RoundedBoxGeometry; RoomEnvironment: typeof import("three/examples/jsm/environments/RoomEnvironment.js").RoomEnvironment };

let kitP: Promise<Kit> | null = null;
function kit(): Promise<Kit> {
  if (!kitP) kitP = Promise.all([
    import("three"),
    import("three/examples/jsm/geometries/RoundedBoxGeometry.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]).then(([THREE, rb, re]) => ({ THREE, RoundedBoxGeometry: rb.RoundedBoxGeometry, RoomEnvironment: re.RoomEnvironment }));
  return kitP;
}

function isDark(THREE: Three, hex: string) { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 < 0.45; }

function logoTex(THREE: Three, dark: boolean) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const x = cv.getContext("2d")!;
  x.fillStyle = dark ? "#F2F2F2" : "#111111";
  x.font = "800 64px Manrope, Helvetica, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("ANTAQOR", 256, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function fabric(THREE: Three, hex: string, extra: Record<string, unknown> = {}) {
  /* sheen = өнгөнөөсөө бага зэрэг цайвар — хар даавуу саарал болохгүй */
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.86, metalness: 0, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.18), ...extra });
}

/** Код дээрх загвар. Буцаана: group + өнгө солих функц. */
function buildModel(k: Kit, kind: string, hex: string): { group: Group; setColor: (h: string, instant?: boolean) => void; tick: () => void } {
  const { THREE, RoundedBoxGeometry } = k;
  const group = new THREE.Group();
  const tinted: MeshPhysicalMaterial[] = [];
  const main = fabric(THREE, hex); tinted.push(main);
  const rib = fabric(THREE, hex, { roughness: 0.95 }); tinted.push(rib);
  const logoMat: MeshBasicMaterial = new THREE.MeshBasicMaterial({ map: logoTex(THREE, isDark(THREE, hex)), transparent: true });
  const lace = new THREE.MeshStandardMaterial({ color: isDark(THREE, hex) ? "#EDEDED" : "#1A1A1A", roughness: 0.6 });
  const add = (geo: BufferGeometry<NormalBufferAttributes>, m: Material, p: [number, number, number], r: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(...p); mesh.rotation.set(...r); mesh.scale.set(...s); group.add(mesh); return mesh;
  };

  if (kind === "cap") {
    add(new THREE.SphereGeometry(1.05, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), main, [0, -0.35, 0], [0, 0, 0], [1, 0.82, 1.05]);
    add(new THREE.CylinderGeometry(1.05, 1.08, 0.06, 48, 1, false, -Math.PI / 2 - 0.9, 1.8), main, [0, -0.36, 0.55], [0.12, 0, 0], [1, 1, 1.25]);
    add(new THREE.SphereGeometry(0.07, 16, 12), rib, [0, 0.5, 0]);
    add(new THREE.PlaneGeometry(1.0, 0.25), logoMat, [0, 0.05, 0.98], [-0.35, 0, 0]);
  } else {
    const tee = kind === "tee";
    add(new RoundedBoxGeometry(1.7, 2.0, 0.78, 6, 0.32), main, [0, -0.2, 0]);
    const sl = tee ? 0.55 : 1.25, sr = tee ? 0.3 : 0.26;
    add(new THREE.CapsuleGeometry(sr, sl, 8, 24), main, [-1.02, tee ? 0.42 : 0.05, 0], [0, 0, tee ? -1.0 : -0.32]);
    add(new THREE.CapsuleGeometry(sr, sl, 8, 24), main, [1.02, tee ? 0.42 : 0.05, 0], [0, 0, tee ? 1.0 : 0.32]);
    if (!tee) {
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24), rib, [-1.3, -0.72, 0], [0, 0, -0.32]);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24), rib, [1.3, -0.72, 0], [0, 0, 0.32]);
      add(new RoundedBoxGeometry(1.6, 0.2, 0.72, 4, 0.09), rib, [0, -1.12, 0]);
      /* малгай (hood) — мөрөн дээр хэвтэж, ар тал руу унжсан */
      add(new THREE.SphereGeometry(0.5, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), main, [0, 0.78, -0.3], [-0.9, 0, 0], [1.05, 0.85, 0.75]);
      add(new THREE.TorusGeometry(0.38, 0.065, 12, 40, Math.PI), rib, [0, 0.8, 0.12], [0.35, 0, Math.PI], [1, 0.9, 1]);
      add(new RoundedBoxGeometry(1.0, 0.48, 0.06, 3, 0.03), main, [0, -0.72, 0.4]);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), lace, [-0.13, 0.48, 0.42], [0.05, 0, 0]);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), lace, [0.13, 0.48, 0.42], [0.05, 0, 0]);
    } else {
      add(new THREE.TorusGeometry(0.34, 0.05, 10, 40), rib, [0, 0.8, 0.05], [Math.PI / 2 - 0.25, 0, 0], [1, 1, 0.6]);
    }
    add(new THREE.PlaneGeometry(0.95, 0.24), logoMat, [0, 0.28, 0.395]);
    group.position.y = 0.05;
  }

  const setColor = (h: string, instant = false) => {
    const target = new THREE.Color(h);
    tinted.forEach((m) => { m.userData.to = target; m.sheenColor.copy(target).lerp(new THREE.Color("#ffffff"), 0.18); if (instant) m.color.copy(target); });
    lace.color.set(isDark(THREE, h) ? "#EDEDED" : "#1A1A1A");
    if (logoMat.map) { logoMat.map.dispose(); logoMat.map = logoTex(THREE, isDark(THREE, h)); logoMat.needsUpdate = true; }
  };
  const tick = () => tinted.forEach((m) => { const to = m.userData.to as TColor | undefined; if (to) m.color.lerp(to, 0.08); });
  return { group, setColor, tick };
}

function shadowMesh(THREE: Three) {
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const g2 = sc.getContext("2d")!;
  const grd = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.38)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  g2.fillStyle = grd; g2.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = -1.55;
  return m;
}

function lights(THREE: Three, scene: InstanceType<Three["Scene"]>) {
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(-4, 2, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
}

/* ── картын зураг: нэг renderer, дараалсан, кэштэй ── */
const thumbCache = new Map<string, Promise<string>>();
let thumbR: { r: InstanceType<Three["WebGLRenderer"]>; env: InstanceType<Three["Texture"]> } | null = null;
let thumbQ: Promise<unknown> = Promise.resolve();

export function renderThumb(kind: string, hex: string, dark = false): Promise<string> {
  const key = `${kind}|${hex}|${dark ? 1 : 0}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const job = thumbQ.then(async () => {
    const k = await kit(); const { THREE } = k;
    if (!thumbR) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(640, 800, false);
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      const pm = new THREE.PMREMGenerator(r);
      thumbR = { r, env: pm.fromScene(new k.RoomEnvironment(), 0.04).texture };
    }
    const scene = new THREE.Scene();
    scene.environment = thumbR.env; scene.environmentIntensity = 0.55;
    lights(THREE, scene);
    const sh = shadowMesh(THREE); if (dark) (sh.material as MeshBasicMaterial).opacity = 0.9; scene.add(sh);
    const m = buildModel(k, kind, hex); m.group.rotation.set(0.04, -0.45, 0); scene.add(m.group);
    const cam = new THREE.PerspectiveCamera(30, 640 / 800, 0.1, 100); cam.position.set(0, 0.2, 8.6);
    thumbR.r.setClearColor(0x000000, 0);
    thumbR.r.render(scene, cam);
    const url = thumbR.r.domElement.toDataURL("image/png");
    scene.traverse((o) => { const me = o as TMesh; me.geometry?.dispose?.(); const mt = me.material as Material | Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()); });
    return url;
  });
  thumbQ = job.catch(() => {});
  thumbCache.set(key, job);
  return job;
}

type Props = { model?: string; kind?: string; color?: string; className?: string; onReady?: () => void };

export default function Product3D({ model, kind = "hoodie", color = "#111111", className, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const colorRef = useRef(color);
  const api = useRef<{ setColor?: (c: string) => void }>({});

  useEffect(() => { colorRef.current = color; api.current.setColor?.(color); }, [color]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const k = await kit(); const { THREE } = k;
      if (disposed) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new k.RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.25, 7.2);
      lights(THREE, scene);
      const shadow = shadowMesh(THREE); scene.add(shadow);

      const rig = new THREE.Group(); scene.add(rig);
      let tick = () => {};

      async function loadGlb(url: string) {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(url);
        const obj = gltf.scene;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        const s = 3.0 / Math.max(size.x, size.y, size.z || 1);
        obj.scale.setScalar(s); obj.position.copy(ctr.multiplyScalar(-s));
        rig.add(obj);
      }
      const proc = () => { const m = buildModel(k, kind, colorRef.current); rig.add(m.group); api.current.setColor = (h) => m.setColor(h); tick = m.tick; };
      if (model) { try { await loadGlb(model); } catch { proc(); } } else proc();
      if (disposed) { renderer.dispose(); renderer.domElement.remove(); return; }

      const fit = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        /* ханцуй эргэхэд ~3.6 нэгж өргөн → нарийн дэлгэцэнд камерыг холдуулна */
        camera.position.z = Math.min(12, Math.max(7.2, 6.9 / (w / h)));
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit); ro.observe(el);

      let drag = false, lx = 0, vel = 0, yaw = -0.5, pitch = 0;
      const down = (e: PointerEvent) => { drag = true; lx = e.clientX; renderer.domElement.style.cursor = "grabbing"; };
      const move = (e: PointerEvent) => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; vel = dx * 0.006; yaw += vel; };
      const up = () => { drag = false; renderer.domElement.style.cursor = "grab"; };
      renderer.domElement.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      const tilt = (e: PointerEvent) => { const r = el.getBoundingClientRect(); pitch = ((e.clientY - r.top) / r.height - 0.5) * 0.25; };
      el.addEventListener("pointermove", tilt);

      /* харагдаагүй үед зурахгүй; гэхдээ анхны төлөв = харагдаж буй (modal дотор IO хоцорч ирдэг) */
      let visible = true;
      const io = new IntersectionObserver((ens) => { const en = ens[ens.length - 1]; visible = en.isIntersecting || en.intersectionRatio > 0; }, { threshold: [0, 0.01] }); io.observe(el);

      const clock = new THREE.Clock();
      let raf = 0, first = true, intro = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
        intro = Math.min(1, intro + dt * 0.9);
        const e = 1 - Math.pow(1 - intro, 3);
        if (!drag) { vel *= 0.94; yaw += vel + (reduce ? 0 : dt * 0.35); }
        rig.rotation.y = yaw + (1 - e) * -1.2;
        rig.rotation.x += (pitch - rig.rotation.x) * 0.06;
        rig.position.y = (reduce ? 0 : Math.sin(t * 1.1) * 0.06) + (1 - e) * -0.6;
        rig.scale.setScalar(0.85 + 0.15 * e);
        shadow.scale.setScalar(1 - (reduce ? 0 : Math.sin(t * 1.1) * 0.05));
        tick();
        renderer.render(scene, camera);
        if (first) { first = false; onReady?.(); }
      };
      renderer.render(scene, camera);
      loop();

      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        el.removeEventListener("pointermove", tilt);
        scene.traverse((o) => { const m = o as TMesh; m.geometry?.dispose?.(); const mt = m.material as Material | Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()); });
        pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
        api.current.setColor = undefined;
      };
    })();

    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, kind]);

  return <div ref={host} className={className} aria-label="3D бүтээгдэхүүн — чирж эргүүлнэ" role="img" />;
}
