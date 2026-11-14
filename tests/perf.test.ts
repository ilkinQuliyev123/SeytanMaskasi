import { describe, expect, it } from "vitest";
import { bottleneck, frameStats } from "../src/game/perf";

describe("perf paneli", () => {
  it("orta / p95 / maks hesablanır", () => {
    const ms = Array.from({ length: 100 }, (_, i) => (i < 95 ? 16 : 50));
    const s = frameStats(ms);
    expect(s.avg).toBeCloseTo(17.7, 1); expect(s.p95).toBe(50); expect(s.max).toBe(50);
    expect(frameStats([])).toEqual({ avg: 0, p95: 0, max: 0 });
  });
  it("yalnız dolmuş hissə sayılır", () => expect(frameStats(new Float32Array([20, 30, 0, 0]), 2).avg).toBe(25));
  it("dar boğazı düzgün təyin edir", () => {
    expect(bottleneck(16.7, 8, 6)).toBe("ok");
    expect(bottleneck(50, 42, null)).toBe("cpu"); // 20 FPS, CPU kadrı doldurur
    expect(bottleneck(50, 9, null)).toBe("gpu"); // CPU boşdur — GPU gözlənilir
    expect(bottleneck(50, 20, 44)).toBe("gpu");
  });
});
