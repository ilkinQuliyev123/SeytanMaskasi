// Giriş: menyu → xəritələr → ordu seçimi → oyun.
import { Engine } from "@babylonjs/core";
import { DEFAULT_SETUP, MAPS, type ArmySetup } from "./game/data";
import { runGame, type Quality } from "./game/game";
import { mainMenu, mapsMenu, setupMenu } from "./ui/ui";
import { runKurtulus } from "./game/kurtulus";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const engine = new Engine(canvas, false, { powerPreference: "high-performance", stencil: true }, false);
addEventListener("resize", () => engine.resize());

// zəif kompüter: əvvəlcə «aşağı» keyfiyyət; ?q=mid ilə orta
const quality: Quality = new URLSearchParams(location.search).get("q") === "mid" ? "mid" : "low";
let setup: ArmySetup = { ...DEFAULT_SETUP };

function home() {
  mainMenu(() => mapsMenu(MAPS, (m) => setupMenu(m, setup, (s) => {
    setup = s;
    if (m.id === "kurtulus") runKurtulus(engine, canvas, m, s, quality, home);
    else runGame(engine, canvas, m, s, quality, home);
  }, home), home));
}
// test rejimi (?auto): menyusuz başla, xəta/FPS-i səhifə başlığına yaz (avtomatik yoxlama üçün)
const Q = new URLSearchParams(location.search);
if (Q.has("flora")) import("./test/flora_view").then((m) => m.floraView(engine)); // Blender modellərinin yoxlaması
else if (Q.get("map") === "kurtulus") { // birbaşa 2-ci xəritə (yoxlama üçün): ?map=kurtulus&n=60&s=20
  addEventListener("error", (e) => (document.title = "ERR " + e.message));
  addEventListener("unhandledrejection", (e) => (document.title = "ERR " + String(e.reason)));
  const m = MAPS.find((x) => x.id === "kurtulus")!;
  runKurtulus(engine, canvas, m, { ...setup, soldiers: Number(Q.get("s") ?? 100), enemies: Number(Q.get("n") ?? 300), weapons: ["sniper", "m16"] }, quality, home)
    .then(() => setTimeout(() => { if (!document.title.startsWith("ERR")) { const g = (window as unknown as { __game: { player: { pos: { x: number; z: number } }; allies: { pos: { x: number; y: number; z: number }; alive: boolean; mesh: { isVisible: boolean; isEnabled(): boolean; isDisposed(): boolean; sourceMesh?: { isEnabled(): boolean; name: string } }; far: { isVisible: boolean } | null }[] } }).__game;
      const a = g.allies[0], vis = g.allies.filter((u) => u.mesh.isVisible || u.far?.isVisible).length;
      document.title = `OK fps=${engine.getFps().toFixed(0)} p=${g.player.pos.x.toFixed(0)},${g.player.pos.z.toFixed(0)} a0=${a.pos.x.toFixed(1)},${a.pos.y.toFixed(1)},${a.pos.z.toFixed(1)} alive=${g.allies.filter((u) => u.alive).length} vis=${vis} mVis=${a.mesh.isVisible} en=${a.mesh.isEnabled()} disp=${a.mesh.isDisposed()} src=${a.mesh.sourceMesh?.name}:${a.mesh.sourceMesh?.isEnabled()} far=${!!a.far} ` + (() => { const m = a.mesh as unknown as { getBoundingInfo(): { boundingSphere: { radiusWorld: number; centerWorld: { x: number; y: number; z: number } } }; isReady(): boolean; getScene(): { getActiveMeshes(): { data: unknown[]; length: number } }; sourceMesh: { isVisible: boolean; instances: unknown[]; skeleton: { bones: unknown[] } | null; getTotalVertices(): number; material: { name: string } | null; position: { y: number }; parent: { name: string } | null } };
        const b = m.getBoundingInfo().boundingSphere, act = m.getScene().getActiveMeshes(); let inAct = false; for (let i = 0; i < act.length; i++) if (act.data[i] === m) inAct = true;
        return `r=${b.radiusWorld.toFixed(1)} c=${b.centerWorld.x.toFixed(0)},${b.centerWorld.y.toFixed(0)},${b.centerWorld.z.toFixed(0)} ready=${m.isReady()} act=${inAct} srcVis=${m.sourceMesh.isVisible} n=${m.sourceMesh.instances.length} bones=${m.sourceMesh.skeleton?.bones.length} v=${m.sourceMesh.getTotalVertices()} mat=${m.sourceMesh.material?.name} par=${m.sourceMesh.parent?.name}`; })(); } }, 6000))
    .catch((e) => (document.title = "ERR " + e));
} else if (new URLSearchParams(location.search).has("auto")) {
  addEventListener("error", (e) => (document.title = "ERR " + e.message));
  addEventListener("unhandledrejection", (e) => (document.title = "ERR " + String(e.reason)));
  runGame(engine, canvas, MAPS[0], setup, quality, home, new URLSearchParams(location.search).get("at") ?? undefined);
  setTimeout(() => { if (!document.title.startsWith("ERR")) document.title = `OK fps=${engine.getFps().toFixed(0)} ui=${document.getElementById("ui")!.innerText.slice(0, 120).replace(/\s+/g, " ")}`; }, 8000);
} else if (new URLSearchParams(location.search).has("test")) { // real ssenari testləri
  addEventListener("error", (e) => (document.title = "ERR " + e.message));
  await runGame(engine, canvas, MAPS[0], { ...setup, enemies: Number(new URLSearchParams(location.search).get("n") ?? 30) }, quality, home);
  const { runScenarios } = await import("./test/scenarios");
  runScenarios((window as unknown as { __game: Parameters<typeof runScenarios>[0] }).__game).catch((e) => (document.title = "ERR " + e));
} else if (new URLSearchParams(location.search).has("setup")) setupMenu(MAPS[0], setup, () => {}, home); // UI yoxlaması üçün
else home();
