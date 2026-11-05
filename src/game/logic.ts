// Babylon-dan asılı olmayan məntiq — test olunur.
import type { Form, Weapon } from "./data";

// --- böyük xəritə: mərkəzdə saray (4 dağ), 4 keçiddən ~1 km yol, sonunda qəsr-kənd ---
export interface Site { id: string; x: number; z: number; R: number; shape: "round" | "square" }
export const SITES: Site[] = [
  { id: "ottoman", x: 0, z: 1050, R: 95, shape: "round" },
  { id: "mongol", x: 1050, z: 0, R: 85, shape: "round" },
  { id: "cin", x: 0, z: -1050, R: 95, shape: "square" },
  { id: "viking", x: -1050, z: 0, R: 80, shape: "round" },
];
export const HALF = 1300; // xəritə ±1300 m
const MOUNTAINS: [number, number][] = [[-150, -150], [150, -150], [-150, 150], [150, 150]];
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const hillsAt = (x: number, z: number) => 5 * Math.sin(x * 0.011 + 0.7) * Math.cos(z * 0.009) + 2.5 * Math.sin(x * 0.027) * Math.sin(z * 0.031 + 1.3);
const valley = (x: number, z: number) => clamp01((Math.hypot(x, z) - 60) / 40); // saray kompleksi düzdür
export const siteBase = (st: Site) => hillsAt(st.x, st.z);

/** yolun yan əyilməsi (s — saraydan məsafə, len — yolun uzunluğu) */
export const roadOffset = (s: number, len: number) => 28 * Math.sin(s / 150) * clamp01(s / 200) * clamp01((len - s) / 150);
/** nöqtənin yola nisbətən koordinatları: s — yol boyu, lat — mərkəz xəttindən yan məsafə */
export function roadCoords(st: Site, x: number, z: number) {
  const L = Math.hypot(st.x, st.z), dx = st.x / L, dz = st.z / L, s = x * dx + z * dz;
  return { s, lat: x * dz - z * dx - roadOffset(s, L - st.R), L };
}
export function roadPoint(st: Site, s: number) {
  const L = Math.hypot(st.x, st.z), dx = st.x / L, dz = st.z / L, o = roadOffset(s, L - st.R);
  return { x: dx * s + dz * o, z: dz * s - dx * o };
}


/** yapon kəndləri: saray ətrafında və şimal yolunun boyunca (yol boyu s, yan sürüşmə) */
export const HAMLETS = [[110, 55], [300, -60], [520, 60], [760, -55]].map(([s, side], i) => {
  const p = roadPoint(SITES[0], s);
  return { id: i, x: p.x + side, z: p.z, r: 32 };
});

export function heightAt(x: number, z: number): number {
  let h = hillsAt(x, z);
  for (const [mx, mz] of MOUNTAINS) h += 90 * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / 7200);
  const e = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 1120); // kənarda sərhəd dağları
  h = (h + e * e * 0.004) * valley(x, z);
  for (const st of SITES) {
    const { s, lat, L } = roadCoords(st, x, z);
    if (s > 0 && s < L && Math.abs(lat) < 22) h = lerp(hillsAt(x, z) * valley(x, z), h, smooth(6, 22, Math.abs(lat)));
    const d = Math.hypot(x - st.x, z - st.z);
    if (d < st.R + 70) h = lerp(siteBase(st), h, smooth(st.R + 25, st.R + 70, d));
  }
  for (const v of HAMLETS) { const d = Math.hypot(x - v.x, z - v.z); if (d < v.r + 30) h = lerp(hillsAt(v.x, v.z), h, smooth(v.r, v.r + 30, d)); }
  return h;
}

export function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// --- maneələr: sadə grid — hər obyekt yalnız yaxın maneələri yoxlayır ---
export type Obstacle = { x: number; z: number; r: number };
export class Grid {
  private cells = new Map<number, Obstacle[]>();
  constructor(public cell = 24) {}
  private key(x: number, z: number) { return Math.floor(x / this.cell) * 4096 + Math.floor(z / this.cell); }
  add(o: Obstacle) { const k = this.key(o.x, o.z); (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(o); }
  near(x: number, z: number): Obstacle[] {
    const out: Obstacle[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = this.cells.get(this.key(x + i * this.cell, z + j * this.cell));
      if (c) out.push(...c);
    }
    return out;
  }
}

// --- qəsr-kənd planı: divar (darvaza saraya baxır), qüllələr, küçələr, evlər, saray, keşikçilər, toplar ---
export interface FortLayout {
  site: Site; base: number; wallH: number; gate: number; ring: number; streets: number[];
  wall: { x: number; z: number; a: number; len: number }[];
  towers: { x: number; z: number; a: number }[];
  houses: { x: number; z: number; w: number; d: number; rot: number }[];
  village: { x: number; z: number; w: number; d: number; rot: number }[]; // divarın çölündəki kənd
  roam: { x: number; z: number }[]; // çöl kənddə gəzinti nöqtələri
  palace: { x: number; z: number; r: number };
  posts: { x: number; z: number; y: number; face: number; kind: "wall" | "gate" | "palace" }[];
  patrol: { x: number; z: number }[];
  cannons: { x: number; z: number; y: number; face: number }[];
}
export const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function fortLayout(st: Site, seed = 1): FortLayout {
  const rnd = rng(seed), N = 48, step = (Math.PI * 2) / N, wallH = 8, base = siteBase(st);
  const gate = Math.atan2(-st.x, -st.z); // darvaza saraya (0,0) baxır
  const rad = (a: number) => st.shape === "square" ? (st.R * 0.85) / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) : st.R;
  const P = (a: number, r: number) => ({ x: st.x + Math.sin(a) * r, z: st.z + Math.cos(a) * r });
  const wall: FortLayout["wall"] = [], towers: FortLayout["towers"] = [], posts: FortLayout["posts"] = [];
  for (let i = 1; i < N; i++) { // i=0 darvaza boşluğudur
    const a0 = gate + (i - 0.5) * step, a1 = gate + (i + 0.5) * step, p0 = P(a0, rad(a0)), p1 = P(a1, rad(a1));
    wall.push({ x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2, a: Math.atan2(p1.x - p0.x, p1.z - p0.z), len: Math.hypot(p1.x - p0.x, p1.z - p0.z) });
    if (i === 1 || i % 8 === 0) towers.push({ ...p0, a: a0 });
    if (i === N - 1) towers.push({ ...p1, a: a1 });
    if (i % 4 === 2) { const m = gate + i * step, p = P(m, rad(m)); posts.push({ ...p, y: base + wallH, face: m, kind: "wall" }); }
  }
  const ring = st.R * 0.58, streets = Array.from({ length: 6 }, (_, k) => gate + (k * Math.PI) / 3), palace = { x: st.x, z: st.z, r: 15 };
  const houses: FortLayout["houses"] = [];
  for (let r = 30; r < st.R; r += 9) {
    const n = Math.floor((Math.PI * 2 * r) / 11), a0 = rnd() * 0.3; // bərabər addım — halqanın başı-sonu üst-üstə düşmür
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / n) * Math.PI * 2;
      const w = 5 + rnd() * 3, d = 5 + rnd() * 2;
      if (rnd() < 0.12 || Math.abs(r - ring) < 4 + d / 2 || r + d / 2 > rad(a) - 5) continue;
      if (streets.some((s) => angDiff(a, s) * r < 3.5 + w / 2)) continue;
      houses.push({ ...P(a, r), w, d, rot: a });
    }
  }
  // çöl kənd: divarın ətrafında 3 halqa ev, aralarında 2 cığır; darvaza yolu boş qalır
  const village: FortLayout["houses"] = [], roam: FortLayout["roam"] = [];
  for (const dr of [11, 29, 47]) {
    const r = st.R + dr, n = Math.floor((Math.PI * 2 * r) / 12), a0 = rnd();
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / n) * Math.PI * 2, w = 5 + rnd() * 3, d = 5 + rnd() * 2;
      if (rnd() < 0.3 || angDiff(a, gate) * r < 16) continue;
      village.push({ ...P(a, rad(a) - st.R + r), w, d, rot: a });
    }
  }
  for (const dr of [20, 38]) for (let k = 0; k < 20; k++) { const a = gate + 0.25 + (k / 20) * (Math.PI * 2 - 0.5); roam.push(P(a, rad(a) - st.R + st.R + dr)); }
  const gi = P(gate, st.R - 10);
  for (const l of [-5, 0, 5]) posts.push({ x: gi.x + Math.cos(gate) * l, z: gi.z - Math.sin(gate) * l, y: base, face: gate, kind: "gate" });
  for (let k = 0; k < 4; k++) { const a = gate + (k * Math.PI) / 2; posts.push({ ...P(a, 21), y: base, face: a, kind: "palace" }); }
  const patrol = Array.from({ length: 24 }, (_, k) => P((k / 24) * Math.PI * 2, ring));
  const go = P(gate, st.R + 14), side = (l: number) => ({ x: go.x + Math.cos(gate) * l, z: go.z - Math.sin(gate) * l, y: base, face: gate });
  const cannons = [...towers].sort((p, q) => angDiff(p.a, gate) - angDiff(q.a, gate)).slice(0, 2)
    .map((t) => ({ x: t.x, z: t.z, y: base + wallH + 4, face: t.a })).concat([side(-9), side(9)]); // qüllələrdə + darvaza yolunun yanında
  return { site: st, base, wallH, gate, ring, streets, wall, towers, houses, village, roam, palace, posts, patrol, cannons };
}

// --- gecə/gündüz: saat (0–24) → günəş hündürlüyü, işıq gücü, səma rəngi ---
export function sunAt(hour: number) {
  const a = ((hour - 6) / 24) * Math.PI * 2; // 6:00 = üfüq, 12:00 = zenit
  const elev = Math.sin(a); // -1..1
  const day = Math.max(0, Math.min(1, elev * 3 + 0.3));
  return { elev, azim: a, day, isNight: day < 0.25 };
}

export function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export const WEATHERS = ["aydın", "buludlu", "yağış", "duman"] as const;
export type WeatherT = (typeof WEATHERS)[number];
export function weatherParams(w: WeatherT) {
  return { aydın: { fog: 0.002, light: 1, rain: 0 }, buludlu: { fog: 0.004, light: 0.7, rain: 0 },
           yağış: { fog: 0.006, light: 0.55, rain: 1 }, duman: { fog: 0.02, light: 0.6, rain: 0 } }[w];
}

// --- görmə: gecə və əyilmə məsafəni azaldır, 120° görüş konusu ---
export function canSee(dx: number, dz: number, facing: number, night: boolean, crouch: boolean, fog: number) {
  const dist = Math.hypot(dx, dz);
  const range = (night ? 22 : 50) * (crouch ? 0.6 : 1) * (fog > 0.01 ? 0.6 : 1);
  if (dist > range) return false;
  if (dist < 4) return true; // çox yaxında hər halda hiss edir
  let diff = Math.atan2(dx, dz) - facing;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) < Math.PI / 3;
}

// --- silah vəziyyəti ---
export class Gun {
  ammo: number; cool = 0; reloading = 0;
  constructor(public w: Weapon) { this.ammo = w.mag; }
  update(dt: number) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.reloading > 0 && (this.reloading -= dt) <= 0) this.ammo = this.w.mag;
  }
  /** atəş açıla bilərsə true qaytarır və sursatı azaldır (soyuq silahda sursat yoxdur) */
  fire(): boolean {
    if (this.cool > 0 || this.reloading > 0) return false;
    if (this.w.mag > 0 && this.ammo <= 0) { this.reload(); return false; }
    if (this.w.mag > 0) this.ammo--;
    this.cool = 1 / this.w.rate;
    if (this.w.mag > 0 && this.ammo === 0 && this.w.reload > 0) this.reload();
    return true;
  }
  reload() { if (this.w.reload > 0 && this.ammo < this.w.mag && this.reloading <= 0) this.reloading = this.w.reload; }
}

/** məsafə və səpələnməyə görə isabət ehtimalı (AI atəşi üçün) */
export function hitChance(w: Weapon, dist: number) {
  if (w.melee) return dist <= w.range ? 0.85 : 0;
  if (dist > w.range) return 0;
  return Math.max(0.05, Math.min(0.95, 1 - dist * w.spread * 4));
}

// --- saat (transformasiya) ---
export class Watch {
  active: Form | null = null; left = 0; cd: Record<string, number> = {};
  constructor(public forms: Form[]) {}
  update(dt: number) {
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.active && (this.left -= dt) <= 0) this.end();
  }
  transform(i: number): boolean {
    const f = this.forms[i];
    if (!f || this.active || (this.cd[f.id] ?? 0) > 0) return false;
    this.active = f; this.left = f.dur; return true;
  }
  end() { if (this.active) { this.cd[this.active.id] = this.active.cd; this.active = null; this.left = 0; } }
}
