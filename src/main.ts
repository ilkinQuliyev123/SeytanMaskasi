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
if (Q.get("map") === "kurtulus") { // birbaşa 2-ci xəritə (yoxlama üçün): ?map=kurtulus&n=60&s=20
  addEventListener("error", (e) => (document.title = "ERR " + e.message));
  addEventListener("unhandledrejection", (e) => (document.title = "ERR " + String(e.reason)));
  const m = MAPS.find((x) => x.id === "kurtulus")!;
  runKurtulus(engine, canvas, m, { ...setup, soldiers: Number(Q.get("s") ?? 100), enemies: Number(Q.get("n") ?? 300), weapons: ["sniper", "m16"] }, quality, home)
    .then(() => setTimeout(() => { if (!document.title.startsWith("ERR")) document.title = `OK fps=${engine.getFps().toFixed(0)}`; }, 6000))
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
