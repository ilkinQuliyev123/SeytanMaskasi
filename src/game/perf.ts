// Performans paneli (F3 və ya ?perf): kadr vaxtı (ms), CPU ↔ GPU bölgüsü, çəkiliş sayı.
// Metod: .claude/skills/performance-optimization — əvvəl ölç, dar boğazı tap, sonra düzəlt.
import { EngineInstrumentation, SceneInstrumentation, type Engine, type Scene } from "@babylonjs/core";

const N = 240; // son ~4 s kadr

/** Kadr vaxtlarından orta / p95 / ən pis (ms). Babylon-suz — testdə yoxlanır. */
export function frameStats(ms: ArrayLike<number>, n = ms.length) {
  if (!n) return { avg: 0, p95: 0, max: 0 };
  const s = Array.from({ length: n }, (_, i) => ms[i]).sort((a, b) => a - b);
  return { avg: s.reduce((a, b) => a + b, 0) / n, p95: s[Math.min(n - 1, Math.floor(n * 0.95))], max: s[n - 1] };
}

/** Dar boğaz: CPU kadr vaxtının böyük hissəsini tutursa CPU, yoxsa GPU; büdcə daxilindədirsə «ok». */
export function bottleneck(frameMs: number, cpuMs: number, gpuMs: number | null, budget = 16.7): "ok" | "cpu" | "gpu" {
  if (frameMs <= budget * 1.15) return "ok";
  if (gpuMs !== null && gpuMs > cpuMs) return "gpu";
  return cpuMs >= frameMs * 0.6 ? "cpu" : "gpu";
}

export function attachPerf(engine: Engine, scene: Scene) {
  let box: HTMLPreElement | null = null, si: SceneInstrumentation | null = null, ei: EngineInstrumentation | null = null;
  const ring = new Float32Array(N); let k = 0, filled = 0, last = 0, shown = 0;
  const gpuName = engine.getGlInfo().renderer;

  const open = () => {
    si = new SceneInstrumentation(scene);
    si.captureFrameTime = si.captureRenderTime = si.captureActiveMeshesEvaluationTime = si.captureAnimationsTime = true;
    ei = new EngineInstrumentation(engine); ei.captureGPUFrameTime = true;
    box = document.createElement("pre");
    box.style.cssText = "position:fixed;left:8px;top:64px;z-index:99;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#9fe8a0;font:11px/1.45 monospace;pointer-events:none;white-space:pre";
    document.body.appendChild(box); k = filled = last = 0;
  };
  const close = () => { si?.dispose(); ei?.dispose(); box?.remove(); si = null; ei = null; box = null; };
  const onKey = (e: KeyboardEvent) => { if (e.code === "F3") { e.preventDefault(); box ? close() : open(); } };
  addEventListener("keydown", onKey);

  const obs = scene.onAfterRenderObservable.add(() => {
    if (!box || !si || !ei) return;
    const now = performance.now();
    if (last) { ring[k] = now - last; k = (k + 1) % N; filled = Math.min(N, filled + 1); }
    last = now;
    if (now - shown < 500 || !filled) return;
    shown = now;
    const f = frameStats(ring, filled);
    const cpu = si.frameTimeCounter.lastSecAverage, draw = si.renderTimeCounter.lastSecAverage;
    const cull = si.activeMeshesEvaluationTimeCounter.lastSecAverage, anim = si.animationsTimeCounter.lastSecAverage;
    const g = ei.gpuFrameTimeCounter.lastSecAverage, gpu = g > 0 ? g / 1e6 : null; // nanosaniyə → ms
    const b = bottleneck(f.avg, cpu, gpu), r = (v: number) => v.toFixed(1).padStart(5);
    box.textContent = [
      `KADR  orta ${r(f.avg)} ms  p95 ${r(f.p95)}  maks ${r(f.max)}   (${(1000 / f.avg).toFixed(0)} FPS, hədəf 16.7 ms)`,
      `CPU   ${r(cpu)} ms = məntiq ${r(Math.max(0, cpu - draw - cull - anim))} + animasiya ${r(anim)} + seçim ${r(cull)} + çəkiliş ${r(draw)}`,
      `GPU   ${gpu === null ? "ölçülmür (brauzer icazə vermir)" : r(gpu) + " ms"}`,
      `SƏHNƏ çəkiliş çağırışı ${si.drawCallsCounter.current}  üçbucaq ${(scene.getActiveIndices() / 3000).toFixed(0)}k  meş ${scene.getActiveMeshes().length}  ekran 1/${engine.getHardwareScalingLevel().toFixed(2)}`,
      `KART  ${gpuName}`,
      cpu <= 0 ? "NƏTİCƏ: CPU vaxtı ölçülmədi (headless/virtual zaman)" : b === "ok" ? "NƏTİCƏ: büdcə daxilində" : b === "cpu" ? "NƏTİCƏ: dar boğaz CPU (məntiq/animasiya/çəkiliş sayı) — ekran ölçüsünü azaltmaq kömək etməz" : "NƏTİCƏ: dar boğaz GPU (piksel/üçbucaq/kölgə) — ekran ölçüsü və effektlər",
    ].join("\n");
  });

  if (new URLSearchParams(location.search).has("perf")) open();
  scene.onDisposeObservable.addOnce(() => { removeEventListener("keydown", onKey); scene.onAfterRenderObservable.remove(obs); close(); });
}
