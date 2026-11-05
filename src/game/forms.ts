// Transformasiya saatı (orijinal dizayn: qırmızı-qara, şeytan maskası emblemi) və 10 orijinal bədheybət modeli.
import { Mesh, Scene } from "@babylonjs/core";
import { glowMat, Kit, vcMat } from "./kit";

type K = Kit;
const legs = (k: K, c: string, w = 0.16, h = 0.85) => { for (const s of [-1, 1]) k.cyl(h, w * 1.2, w, c, [s * 0.17, h / 2, 0]); return k; };
const arms = (k: K, c: string, y = 1.15, w = 0.13, spread = 0.38) => { for (const s of [-1, 1]) k.cyl(0.65, w, w * 0.9, c, [s * spread, y, 0.03], [0.1, 0, s * 0.18]); return k; };
const eyes = (k: K, c: string, y: number, z: number, sp = 0.08) => { for (const s of [-1, 1]) k.box(0.08, 0.05, 0.03, c, [s * sp, y, z]); return k; };

const FORM_MODELS: Record<string, (k: K) => unknown> = {
  alov: (k) => { legs(k, "#c23a00"); arms(k, "#e05a00"); k.cyl(0.75, 0.6, 0.42, "#ff7a10", [0, 1.3, 0]).sph(0.5, "#ffb020", [0, 1.9, 0]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cyl(0.55, 0, 0.16, i % 2 ? "#ffd040" : "#ff6a00", [Math.sin(a) * 0.15, 2.25, Math.cos(a) * 0.15], [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], 5); }
    eyes(k, "#fff6c0", 1.92, 0.23); },
  ildirim: (k) => { legs(k, "#1d2a4a", 0.13, 0.95); arms(k, "#1d2a4a", 1.2, 0.1); k.cyl(0.7, 0.48, 0.3, "#24365e", [0, 1.35, 0]).box(0.08, 0.7, 0.04, "#ffe14d", [0.06, 1.35, 0.2], [0, 0, 0.5])
    .sph(0.4, "#24365e", [0, 1.9, 0.02], [0.85, 1, 1.2]).cyl(0.6, 0, 0.18, "#ffe14d", [0, 2.1, -0.2], [-1.1, 0, 0], 4); eyes(k, "#9ff6ff", 1.92, 0.24, 0.07); },
  qaya: (k) => { legs(k, "#6e675a", 0.3, 0.8); for (const s of [-1, 1]) k.sph(0.7, "#7d7566", [s * 0.62, 1.55, 0]).cyl(0.7, 0.4, 0.34, "#6e675a", [s * 0.7, 1.05, 0.05], undefined, 6).sph(0.48, "#8a8170", [s * 0.72, 0.65, 0.1], undefined, 4);
    k.sph(1.25, "#8a8170", [0, 1.4, 0], [1, 1, 0.8], 4).sph(0.45, "#7d7566", [0, 2.05, 0.15], undefined, 4); eyes(k, "#ff9a3a", 2.05, 0.36, 0.1); },
  kolge: (k) => { k.cyl(1.6, 0.45, 0.9, "#1a1028", [0, 0.8, 0], undefined, 9).sph(0.5, "#22143a", [0, 1.85, 0]).cyl(0.6, 0.02, 0.5, "#1a1028", [0, 2.15, -0.1], [-0.4, 0, 0], 6);
    arms(k, "#1a1028", 1.15, 0.12, 0.42); eyes(k, "#c070ff", 1.88, 0.23); },
  buz: (k) => { legs(k, "#5fb6e0"); arms(k, "#7fd8ff"); k.cyl(0.75, 0.6, 0.4, "#9fe4ff", [0, 1.32, 0], undefined, 6).sph(0.46, "#c8f2ff", [0, 1.9, 0], undefined, 4);
    for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; k.cyl(0.5 + (i % 2) * 0.3, 0, 0.14, "#e6fbff", [Math.sin(a) * 0.3, 1.75, -0.2], [-0.6, 0, a], 4); } eyes(k, "#1a3cff", 1.92, 0.22); },
  qanad: (k) => { legs(k, "#6a4a2a", 0.12); arms(k, "#8a6a3a"); k.cyl(0.7, 0.5, 0.36, "#a07a40", [0, 1.32, 0]).sph(0.4, "#e8d8b0", [0, 1.88, 0]).cyl(0.25, 0, 0.12, "#e0a020", [0, 1.85, 0.27], [Math.PI / 2, 0, 0], 4);
    for (const s of [-1, 1]) k.box(1.6, 0.06, 0.7, "#c8a868", [s * 1.0, 1.65, -0.25], [0, 0, s * 0.35]).box(1.1, 0.05, 0.5, "#e0c070", [s * 1.5, 1.85, -0.35], [0, 0, s * 0.55]); eyes(k, "#ff3a2a", 1.9, 0.2); },
  horumcek: (k) => { legs(k, "#2a1430"); k.cyl(0.7, 0.55, 0.38, "#3a1a44", [0, 1.3, 0]).sph(0.55, "#4a2058", [0, 1.32, -0.35], [1, 1, 1.2]).sph(0.4, "#2a1430", [0, 1.88, 0]);
    for (const s of [-1, 1]) for (const y of [1.0, 1.35]) k.cyl(0.8, 0.08, 0.06, "#2a1430", [s * 0.5, y, 0.1], [0.3, 0, s * 0.9], 5);
    for (let i = 0; i < 4; i++) k.box(0.05, 0.05, 0.03, "#7aff5a", [-0.11 + i * 0.075, 1.93 + (i % 2) * 0.05, 0.19]); },
  maqnit: (k) => { legs(k, "#5c6470"); arms(k, "#7c8490", 1.15, 0.15); k.cyl(0.75, 0.62, 0.45, "#8c96a4", [0, 1.32, 0], undefined, 8).box(0.42, 0.4, 0.4, "#9aa4b2", [0, 1.9, 0]);
    for (const s of [-1, 1]) k.box(0.12, 0.35, 0.12, "#c0242a", [s * 0.36, 2.25, 0]).box(0.12, 0.12, 0.12, "#e8e8e8", [s * 0.36, 2.45, 0]); eyes(k, "#5af0ff", 1.93, 0.21, 0.1); },
  kicik: (k) => { legs(k, "#3a6a2a", 0.2, 0.5); arms(k, "#4a8a36", 0.75, 0.12, 0.42); k.sph(0.85, "#5aa040", [0, 0.95, 0], [1, 0.9, 0.9], 5).sph(0.6, "#7ab648", [0, 1.55, 0.05], undefined, 5);
    for (const s of [-1, 1]) k.cyl(0.35, 0, 0.12, "#7ab648", [s * 0.32, 1.75, 0], [0, 0, -s * 1.1], 4); eyes(k, "#ffe14d", 1.6, 0.32, 0.12); },
  qalxan: (k) => { legs(k, "#24407a", 0.2); arms(k, "#2e5aa0", 1.15, 0.16, 0.44); k.cyl(0.8, 0.7, 0.5, "#3a6ac0", [0, 1.33, 0], undefined, 8).sph(0.48, "#24407a", [0, 1.92, 0], [1, 1.05, 1])
    .cyl(0.08, 1.2, 1.2, "#7ab0ff", [-0.65, 1.25, 0.25], [0, 0, Math.PI / 2], 14).cyl(0.1, 0.4, 0.4, "#d4a640", [-0.7, 1.25, 0.25], [0, 0, Math.PI / 2], 10); eyes(k, "#e8f4ff", 1.94, 0.23); },
};

export function formModel(scene: Scene, id: string): Mesh {
  const k = new Kit(scene);
  (FORM_MODELS[id] ?? FORM_MODELS.alov)(k);
  return k.build("form_" + id, vcMat(scene, "vcForm", 0.3));
}

/** sol qoldakı saat: qolbaq + parlayan siferblat (emblem: buynuzlu maska) */
export function watchModel(scene: Scene) {
  const band = new Kit(scene).cyl(0.14, 0.17, 0.17, "#121214", [0, 0, 0], undefined, 10).box(0.2, 0.06, 0.2, "#2a2a30", [0, 0, 0.09]).build("watchBand", vcMat(scene, "vcGun", 0.35));
  const dial = new Kit(scene).cyl(0.03, 0.15, 0.15, "#ffffff", [0, 0, 0.125], [Math.PI / 2, 0, 0], 12)
    .box(0.03, 0.06, 0.01, "#ffffff", [-0.045, 0.03, 0.14], [0, 0, 0.5]).box(0.03, 0.06, 0.01, "#ffffff", [0.045, 0.03, 0.14], [0, 0, -0.5]).build("watchDial", glowMat(scene, "#ff1e2a", "watchGlow"));
  dial.parent = band;
  return { band, dial };
}
