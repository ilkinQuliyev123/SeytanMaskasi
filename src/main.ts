// Giriş: menyu → xəritələr → ordu seçimi → oyun.
import { Engine } from "@babylonjs/core";
import { DEFAULT_SETUP, MAPS, type ArmySetup } from "./game/data";
import { runGame, type Quality } from "./game/game";
import { mainMenu, mapsMenu, setupMenu } from "./ui/ui";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const engine = new Engine(canvas, false, { powerPreference: "high-performance", stencil: true }, false);
addEventListener("resize", () => engine.resize());

// zəif kompüter: əvvəlcə «aşağı» keyfiyyət; ?q=mid ilə orta
const quality: Quality = new URLSearchParams(location.search).get("q") === "mid" ? "mid" : "low";
let setup: ArmySetup = { ...DEFAULT_SETUP };

function home() {
  mainMenu(() => mapsMenu(MAPS, (m) => setupMenu(m, setup, (s) => {
    setup = s;
    runGame(engine, canvas, m, s, quality, home);
  }, home), home));
}
// test rejimi (?auto): menyusuz başla, xəta/FPS-i səhifə başlığına yaz (avtomatik yoxlama üçün)
if (new URLSearchParams(location.search).has("auto")) {
  addEventListener("error", (e) => (document.title = "ERR " + e.message));
  addEventListener("unhandledrejection", (e) => (document.title = "ERR " + String(e.reason)));
  runGame(engine, canvas, MAPS[0], setup, quality, home);
  setTimeout(() => { if (!document.title.startsWith("ERR")) document.title = `OK fps=${engine.getFps().toFixed(0)} ui=${document.getElementById("ui")!.innerText.slice(0, 120).replace(/\s+/g, " ")}`; }, 8000);
} else home();
