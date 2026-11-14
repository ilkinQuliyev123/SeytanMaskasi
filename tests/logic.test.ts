import { describe, it, expect } from "vitest";
import { heightAt, sunAt, weatherParams, canSee, Gun, hitChance, Watch, WEATHERS } from "../src/game/logic";
import { WEAPONS, FORMS } from "../src/game/data";

describe("heightAt", () => {
  it("center valley is flat", () => {
    expect(Math.abs(heightAt(0, 0))).toBeLessThan(0.5);
  });
  it("mountain peak is high and a pass is lower", () => {
    expect(heightAt(150, 150)).toBeGreaterThan(50);
    expect(heightAt(0, 150)).toBeLessThan(heightAt(150, 150));
  });
});

describe("sunAt", () => {
  it("noon is high sun, daytime", () => {
    const s = sunAt(12);
    expect(s.elev).toBeCloseTo(1, 5);
    expect(s.isNight).toBe(false);
  });
  it("midnight is night, 06:00 is horizon", () => {
    expect(sunAt(0).isNight).toBe(true);
    expect(sunAt(6).elev).toBeCloseTo(0, 5);
  });
});

describe("weatherParams", () => {
  it("rain has rain 1, smoke has the largest fog", () => {
    expect(weatherParams("yağış").rain).toBe(1);
    const maxFog = Math.max(...WEATHERS.map((w) => weatherParams(w).fog));
    expect(weatherParams("duman").fog).toBe(maxFog);
  });
});

describe("canSee", () => {
  const see = (dx: number, dz: number, night = false, crouch = false) =>
    canSee(dx, dz, 0, night, crouch, 0.002);
  it("sees straight ahead in daylight, not behind", () => {
    expect(see(0, 20)).toBe(true);
    expect(see(0, -20)).toBe(false);
  });
  it("night and crouch shorten range", () => {
    expect(see(0, 30, true)).toBe(false);
    expect(see(0, 40)).toBe(true);
    expect(see(0, 40, false, true)).toBe(false);
  });
  it("very close targets are always sensed", () => {
    expect(see(0, -2)).toBe(true);
  });
});

describe("Gun", () => {
  it("atəş tezliyi FPS-dən asılı deyil (10 s fasiləsiz atəş)", () => {
    for (const w of [WEAPONS.m16, WEAPONS.aug, WEAPONS.glock]) for (const fps of [20, 30, 60, 144]) {
      const g = new Gun({ ...w, mag: 100000 }); let n = 0;
      for (let i = 0; i < fps * 10; i++) { if (g.fire()) n++; g.update(1 / fps); }
      expect(Math.abs(n - w.rate * 10), `${w.id} @${fps}`).toBeLessThanOrEqual(1);
    }
  });
  it("fasilədən sonra atəş yığılmır", () => {
    const g = new Gun({ ...WEAPONS.m16, mag: 100000 });
    g.update(5); expect(g.fire()).toBe(true); g.update(1 / 60); expect(g.fire()).toBe(false);
  });
  it("rifle has cooldown, recovers, and reloads after emptying the mag", () => {
    const g = new Gun(WEAPONS.rifle);
    expect(g.fire()).toBe(true);
    expect(g.fire()).toBe(false);
    g.update(2);
    expect(g.fire()).toBe(true);
    for (let i = 0; i < 2; i++) { g.update(2); g.fire(); } // shots 3–4
    g.update(2);
    expect(g.fire()).toBe(true); // 5th shot empties the mag
    expect(g.reloading).toBeGreaterThan(0);
    g.update(3);
    expect(g.ammo).toBe(5);
  });
  it("melee weapon never runs out of ammo", () => {
    const g = new Gun(WEAPONS.katana);
    expect(g.fire()).toBe(true);
    g.update(1);
    expect(g.fire()).toBe(true);
  });
});

describe("hitChance", () => {
  it("katana hits close, misses at 5m", () => {
    expect(hitChance(WEAPONS.katana, 2)).toBeGreaterThan(0);
    expect(hitChance(WEAPONS.katana, 5)).toBe(0);
  });
  it("rifle is more accurate at 10m than 100m, zero beyond range", () => {
    expect(hitChance(WEAPONS.rifle, 10)).toBeGreaterThan(hitChance(WEAPONS.rifle, 100));
    expect(hitChance(WEAPONS.rifle, 200)).toBe(0);
  });
});

describe("Watch", () => {
  it("transform lasts its duration, then goes on cooldown", () => {
    const w = new Watch(FORMS);
    expect(w.transform(0)).toBe(true);
    expect(w.transform(1)).toBe(false);
    w.update(FORMS[0].dur + 0.1);
    expect(w.active).toBeNull();
    expect(w.cd[FORMS[0].id]).toBeGreaterThan(0);
    expect(w.transform(0)).toBe(false);
    expect(w.transform(1)).toBe(true);
  });
});
