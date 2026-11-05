import { describe, it, expect } from "vitest";
import { heightAt, SITES, roadPoint, roadCoords, siteBase, Grid, fortLayout, angDiff, rng } from "../src/game/logic";

const ottoman = SITES.find((s) => s.id === "ottoman")!;
const cin = SITES.find((s) => s.id === "cin")!;

describe("site terrain", () => {
  it("site center and 30 m out are flat at siteBase", () => {
    for (const st of SITES) {
      expect(heightAt(st.x, st.z)).toBeCloseTo(siteBase(st), 3);
      expect(heightAt(st.x + 30, st.z)).toBeCloseTo(siteBase(st), 3);
    }
  });
});

describe("road", () => {
  it("ottoman road is walkable and centred (lat ~ 0)", () => {
    let prev: { x: number; z: number } | null = null;
    for (let s = 100; s <= 900; s += 20) {
      const p = roadPoint(ottoman, s);
      expect(Math.abs(roadCoords(ottoman, p.x, p.z).lat)).toBeLessThan(0.01);
      if (prev) expect(Math.abs(heightAt(p.x, p.z) - heightAt(prev.x, prev.z))).toBeLessThan(3);
      prev = p;
    }
  });
});

describe("Grid", () => {
  it("returns nearby obstacles only", () => {
    const g = new Grid();
    g.add({ x: 10, z: 10, r: 1 });
    expect(g.near(30, 30)).toContainEqual({ x: 10, z: 10, r: 1 });
    expect(g.near(200, 200)).toEqual([]);
  });
});

describe("fortLayout", () => {
  it("is deterministic per seed and varies with seed", () => {
    const a = fortLayout(ottoman, 7), b = fortLayout(ottoman, 7), c = fortLayout(ottoman, 8);
    expect(a).toEqual(b);
    expect(c.houses).not.toEqual(a.houses);
    // rng itself is deterministic too
    const r1 = rng(7), r2 = rng(7);
    expect([r1(), r1()]).toEqual([r2(), r2()]);
  });

  it("gate is open: no wall segment centre within 7 m of the gate", () => {
    for (const st of SITES) {
      const f = fortLayout(st, 1);
      const gx = st.x + Math.sin(f.gate) * st.R, gz = st.z + Math.cos(f.gate) * st.R;
      for (const w of f.wall) expect(Math.hypot(w.x - gx, w.z - gz)).toBeGreaterThan(7);
    }
  });

  it("houses respect palace, each other, the wall and the streets", () => {
    for (const st of SITES) {
      const f = fortLayout(st, 1);
      for (const h of f.houses) {
        expect(Math.hypot(h.x - st.x, h.z - st.z)).toBeGreaterThanOrEqual(f.palace.r + 6);
        if (st.shape === "round") expect(Math.hypot(h.x - st.x, h.z - st.z)).toBeLessThan(st.R);
        const r = Math.hypot(h.x - st.x, h.z - st.z);
        const ang = Math.atan2(h.x - st.x, h.z - st.z);
        for (const s of f.streets) expect(angDiff(ang, s) * r).toBeGreaterThanOrEqual(3.5 + h.w / 2 - 0.01);
      }
      for (let i = 0; i < f.houses.length; i++) for (let j = i + 1; j < f.houses.length; j++) {
        const a = f.houses[i], b = f.houses[j];
        const min = Math.max(a.w, a.d) / 2 + Math.max(b.w, b.d) / 2;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it("ottoman counts are sane and wall posts sit on the wall top", () => {
    const f = fortLayout(ottoman, 1);
    expect(f.houses.length).toBeGreaterThan(80);
    expect(f.cannons).toHaveLength(4);
    const kinds = new Set(f.posts.map((p) => p.kind));
    expect(kinds).toContain("wall");
    expect(kinds).toContain("gate");
    expect(kinds).toContain("palace");
    for (const p of f.posts.filter((p) => p.kind === "wall")) expect(p.y).toBeCloseTo(f.base + f.wallH, 6);
  });

  it("square site (cin) builds with many houses", () => {
    const f = fortLayout(cin, 1);
    expect(f.houses.length).toBeGreaterThan(60);
  });
});
