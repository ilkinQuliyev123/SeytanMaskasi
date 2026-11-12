// Döyüş taktikası simulyasiyası (brauzersiz): əsgərlər əyilir/uzanır, qaya arxasına keçir?
import { describe, it, expect, vi } from "vitest";
import { NullEngine, Scene, MeshBuilder, Vector3 } from "@babylonjs/core";

vi.mock("../src/game/kit", () => ({
  unitModel: (scene: Scene, id: string) => MeshBuilder.CreateBox("m_" + id, { size: 1 }, scene),
}));

import { Unit, type Cover, type Ctx } from "../src/game/units";
import { UNITS } from "../src/game/data";
import { Grid } from "../src/game/logic";

const scene = new Scene(new NullEngine());
const noop = () => {};

function rocks(x0: number, x1: number, step: number): { grid: Grid; list: Cover[] } {
  const grid = new Grid(), list: Cover[] = [];
  for (let x = x0; x <= x1; x += step) for (let z = -60; z <= 60; z += step) {
    const c = { x: x + (Math.random() - 0.5) * 4, z: z + (Math.random() - 0.5) * 4, r: 1.6, h: 3, n: 0 };
    list.push(c); grid.add(c as any);
  }
  return { grid, list };
}

function sim(order: "follow" | "attack", rockStep: number, secs = 25) {
  const leader = new Vector3(0, 0, 0);
  const allies = Array.from({ length: 20 }, (_, i) => new Unit(scene, UNITS.turk, "mauser", new Vector3(-3 - (i % 5) * 2, 0, (i % 4) * 2 - 3), new Vector3(0, 0, 0)));
  const enemies = Array.from({ length: 20 }, (_, i) => new Unit(scene, UNITS.isgalci, "mauser", new Vector3(45 + (i % 4) * 3, 0, (i % 5) * 4 - 8), new Vector3(60, 0, 0)));
  for (const e of enemies) e.facing = -Math.PI / 2; // bizə baxır
  const { grid: covers } = rocks(-40, 80, rockStep);
  const grid = new Grid();
  const stats = { aCrouch: 0, aProne: 0, aCover: 0, eCrouch: 0, eProne: 0, eCover: 0, aTarget: 0, eTarget: 0, frames: 0, rolls: 0 };
  const dt = 1 / 30;
  for (let t = 0; t < secs; t += dt) {
    if (order === "attack") for (const a of allies) (a.squadGoal ??= new Vector3()).set(30, 0, a.pos.z);
    allies.forEach((u, i) => u.update(dt, { foes: enemies, night: false, fog: 0, leader, order, grid, mates: allies, onShot: noop, slot: i, covers } as Ctx));
    enemies.forEach((u) => u.update(dt, { foes: allies, night: false, fog: 0, leader, order: "attack", grid, mates: enemies, onShot: noop, slot: 0, covers } as Ctx));
    Unit.tickFalls(dt);
    if (t > 5) {
      stats.frames++;
      for (const a of allies) if (a.alive) { if (a.stance === "crouch") stats.aCrouch++; if (a.stance === "prone") stats.aProne++; if ((a as any).cover) stats.aCover++; if (a.target) stats.aTarget++; if ((a as any).rollT > 0) stats.rolls++; }
      for (const e of enemies) if (e.alive) { if (e.stance === "crouch") stats.eCrouch++; if (e.stance === "prone") stats.eProne++; if ((e as any).cover) stats.eCover++; if (e.target) stats.eTarget++; if ((e as any).rollT > 0) stats.rolls++; }
    }
  }
  const n = stats.frames * 20;
  const r = (k: number) => Math.round((k / n) * 100);
  return { allyLow: r(stats.aCrouch + stats.aProne), allyCover: r(stats.aCover), enemyLow: r(stats.eCrouch + stats.eProne), enemyCover: r(stats.eCover),
    allyTarget: r(stats.aTarget), enemyTarget: r(stats.eTarget), rolls: stats.rolls, aliveA: allies.filter((a) => a.alive).length, aliveE: enemies.filter((a) => a.alive).length };
}

describe("döyüş taktikası", () => {
  it("izlə əmrində, oyunçu dayananda: əsgərlərin çoxu əyilir/uzanır və hədəf görür", () => {
    const s = sim("follow", 12);
    console.log("follow, qaya 12 m:", s);
    expect(s.allyTarget).toBeGreaterThan(15);
    expect(s.allyLow + s.allyCover).toBeGreaterThan(40);
    expect(s.enemyLow + s.enemyCover).toBeGreaterThan(30);
  });
  it("qayalar sıx olanda (12 m) əsgərlərin xeyli hissəsi sığınacaqdadır", () => {
    const s = sim("follow", 12);
    expect(s.allyCover + s.enemyCover).toBeGreaterThan(30);
  });
  it("qayalar seyrək olanda (70 m — indiki xəritə) sığınacaq demək olar yoxdur (problemin sübutu)", () => {
    const s = sim("follow", 70);
    console.log("follow, qaya 70 m:", s);
  });
  it("qayalar 30 m aralı (yeni xəritə sıxlığı) — sığınacaq var", () => {
    const s = sim("follow", 30);
    console.log("follow, qaya 30 m:", s);
    expect(s.allyCover + s.enemyCover).toBeGreaterThan(15);
  });
  it("canavarlar (B): 21 canavar ən yaxın düşmənə qaçıb parçalayır; izləmədə yanında qalır", () => {
    const leader = new Vector3(0, 0, 0), grid = new Grid();
    const wolves = Array.from({ length: 21 }, (_, i) => new Unit(scene, UNITS.canavar, "bite", new Vector3(Math.cos(i) * 6, 0, Math.sin(i) * 6), new Vector3(0, 0, 0)));
    const enemies = Array.from({ length: 20 }, (_, i) => new Unit(scene, UNITS.isgalci, "mauser", new Vector3(120 + (i % 4) * 3, 0, (i % 5) * 4 - 8), new Vector3(130, 0, 0)));
    for (const e of enemies) e.facing = -Math.PI / 2;
    const dt = 1 / 30; let maxFollowDist = 0;
    for (let t = 0; t < 8; t += dt) { // izləmə: düşmən uzaqdadır — canavarlar liderin yanında qalır
      wolves.forEach((w, i) => w.update(dt, { foes: [], night: false, fog: 0, leader, order: "follow", grid, mates: wolves, onShot: noop, slot: i } as Ctx));
      for (const w of wolves) maxFollowDist = Math.max(maxFollowDist, Vector3.Distance(w.pos, leader));
    }
    expect(maxFollowDist).toBeLessThan(14);
    for (let t = 0; t < 40; t += dt) { // hücum: alert = ən yaxın düşmən (oyun hər 0.5 s verir)
      for (const w of wolves) if (w.alive && !w.target) { let bd = 1e12, b: Unit | null = null; for (const e of enemies) if (e.alive) { const d = Vector3.DistanceSquared(e.pos, w.pos); if (d < bd) { bd = d; b = e; } } w.alert = b ? b.pos.clone() : null; }
      wolves.forEach((w, i) => w.update(dt, { foes: enemies, night: false, fog: 0, leader, order: "attack", grid, mates: wolves, onShot: noop, slot: i } as Ctx));
      enemies.forEach((u) => u.update(dt, { foes: wolves, night: false, fog: 0, leader, order: "attack", grid, mates: enemies, onShot: noop, slot: 0 } as Ctx));
      Unit.tickFalls(dt);
    }
    const aliveE = enemies.filter((e) => e.alive).length, aliveW = wolves.filter((w) => w.alive).length;
    console.log("canavar:", { aliveE, aliveW, stances: wolves.map((w) => w.stance).filter((s) => s !== "stand").length });
    expect(aliveE).toBeLessThan(10);
    expect(wolves.every((w) => w.stance === "stand")).toBe(true);
  });
  it("SWAT: maşından düşəndə maşının arxasında gizlənib döyüşür", () => {
    const car = new Vector3(0, 0, 0), grid = new Grid(), cover = { x: 0, z: 0, r: 3.4, h: 3.1, n: 0, cap: 14 };
    const covers = { near: () => [cover] } as unknown as Grid;
    const swat = Array.from({ length: 14 }, (_, i) => new Unit(scene, UNITS.swat, "m4", new Vector3(Math.cos(i) * 4.5, 0, Math.sin(i) * 4.5), new Vector3(0, 0, 0)));
    const enemies = Array.from({ length: 19 }, (_, i) => new Unit(scene, UNITS.isgalci, "mauser", new Vector3(100 + (i % 4) * 3, 0, (i % 5) * 4 - 8), new Vector3(100, 0, 0)));
    for (const e of enemies) { e.facing = -Math.PI / 2; e.alert = new Vector3(0, 0, 0); }
    const dt = 1 / 30; let inCover = 0, frames = 0, withTarget = 0;
    for (let t = 0; t < 40; t += dt) {
      swat.forEach((u, i) => u.update(dt, { foes: enemies, night: false, fog: 0, leader: car, order: "follow", grid, mates: swat, onShot: noop, slot: i, covers } as Ctx));
      enemies.forEach((u) => u.update(dt, { foes: swat, night: false, fog: 0, leader: car, order: "attack", grid, mates: enemies, onShot: noop, slot: 0, aware: true } as Ctx));
      Unit.tickFalls(dt); frames++;
      for (const u of swat) if (u.alive) { if ((u as any).cover) inCover++; if (u.target) withTarget++; }
    }
    const res = { aliveE: enemies.filter((e) => e.alive).length, aliveS: swat.filter((u) => u.alive).length, coverPct: Math.round(inCover / frames / 14 * 100), targetPct: Math.round(withTarget / frames / 14 * 100) };
    console.log("SWAT:", JSON.stringify(res));
    expect(res.aliveE).toBeLessThan(10);
    expect(res.coverPct).toBeGreaterThan(8);
  });
  it("hücum əmrində qrup irəliləyir və döyüşür", () => {
    const s = sim("attack", 12, 30);
    console.log("attack:", s);
    expect(s.aliveE).toBeLessThan(20);
  });
});
