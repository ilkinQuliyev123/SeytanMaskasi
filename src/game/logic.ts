// Babylon-dan asılı olmayan məntiq — test olunur.
import type { Form, Weapon } from "./data";

// --- relyef: 4 dağ künclərdə, mərkəzdə düz vadi (saray), keçidlər dağların arasında ---
const MOUNTAINS: [number, number][] = [[-150, -150], [150, -150], [-150, 150], [150, 150]];
export function heightAt(x: number, z: number): number {
  let h = 0;
  for (const [mx, mz] of MOUNTAINS) {
    const d2 = (x - mx) ** 2 + (z - mz) ** 2;
    h += 70 * Math.exp(-d2 / (2 * 55 ** 2));
  }
  const r = Math.hypot(x, z);
  const valley = Math.min(1, Math.max(0, (r - 45) / 40)); // mərkəz düzdür
  return h * valley + valley * 1.5 * Math.sin(x * 0.05) * Math.cos(z * 0.04);
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
