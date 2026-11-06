// Brauzerdə real oyun ssenariləri (yalnız ?test rejimində yüklənir). Nəticə səhifə başlığına yazılır:
// "TEST 5/5 ok" və ya "TEST 3/5 | <uğursuz ssenarilər>". Edge headless ilə avtomatik işlədilir.
import { Vector3 } from "@babylonjs/core";
import { heightAt } from "../game/logic";

type G = {
  player: { pos: Vector3; riding: unknown; yaw: number; flyH: number; jumpH: number; hp: number };
  dragon: { pos: Vector3; alive: boolean };
  enemies: { pos: Vector3; alive: boolean; post: unknown; mesh: { position: Vector3 } }[];
  allies: { pos: Vector3; alive: boolean }[];
  grid: { near(x: number, z: number): { x: number; z: number; r: number }[] };
  forts: { lay: { site: { x: number; z: number; R: number }; gate: number } }[];
  state: () => { paused: boolean; ended: boolean; time: number };
};

let G0: G;
/** OYUN vaxtı ilə gözlə (ms) — proqram renderində kadr az olduğu üçün real saat yox */
const wait = async (ms: number) => { const t0 = G0.state().time; while (G0.state().time - t0 < ms / 1000) await new Promise((r) => setTimeout(r, 50)); };
const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
const press = async (code: string, ms = 80) => { key(code, true); await wait(ms); key(code, false); };

export async function runScenarios(g: G) {
  G0 = g;
  const res: [string, boolean, string][] = [];
  const check = (name: string, ok: boolean, info = "") => { res.push([name, ok, info]); document.title = `TEST… ${res.length} t=${g.state().time.toFixed(1)} ${name}:${ok}`; };
  setInterval(() => { if (document.title.startsWith("TEST…") || document.title === "Şeytan Maskası") document.title = document.title.replace(/ t=[\d.]+/, "") + ` t=${g.state().time.toFixed(1)}`; }, 1000);
  await wait(3000);
  // 0) oyun işləyir və oyunçu hərəkət edir (açıq sahədə 2 s irəli)
  const st0 = g.state(); g.player.pos.set(0, 0, 20); g.player.yaw = 0; const z0 = g.player.pos.z;
  key("KeyW", true); await wait(2000); key("KeyW", false);
  check("hərəkət", g.player.pos.z - z0 > 5, `${(g.player.pos.z - z0).toFixed(1)} m, pauza=${st0.paused}`);

  // 1) heç kim havada qalmır / batmır (keşikçilər istisna — divar üstündədirlər)
  const ground = g.enemies.filter((e) => e.alive && !e.post);
  const bad = ground.filter((e) => Math.abs(e.mesh.position.y - heightAt(e.pos.x, e.pos.z)) > 0.15).length;
  check("yerə oturma", bad === 0, `${bad}/${ground.length} havada/batıb`);

  // 2) heç kim maneənin (ev/divar) içində deyil
  const inside = (p: Vector3) => g.grid.near(p.x, p.z).some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r - 0.3);
  await wait(4000);
  const stuck = g.enemies.filter((e) => e.alive && !e.post && inside(e.pos)).length;
  check("divar/ev içində yoxdur", stuck <= 2, `${stuck} əsgər maneə içində`);

  // 3) oyunçu divardan keçə bilmir: qəsr divarına (darvazadan uzaq) 4 s qaç
  const f = g.forts[0].lay, a = f.gate + Math.PI / 4, R = f.site.R;
  g.player.pos.set(f.site.x + Math.sin(a) * (R + 6), 0, f.site.z + Math.cos(a) * (R + 6));
  g.player.yaw = a + Math.PI; // mərkəzə bax
  key("KeyW", true); await wait(4000); key("KeyW", false);
  const dIn = Math.hypot(g.player.pos.x - f.site.x, g.player.pos.z - f.site.z);
  check("divardan keçmir", dIn > R - 0.5, `mərkəzdən ${dIn.toFixed(1)} m (divar ${R})`);

  // 4) əjdaha: G — gəlir, enir, mindirir; G — düşür, yerdə dayanır
  g.player.pos.set(0, 0, 20); g.player.yaw = 0;
  await press("KeyG"); await wait(9000);
  check("əjdahaya minmək", !!g.player.riding, `məsafə ${Vector3.Distance(g.dragon.pos, g.player.pos).toFixed(1)} m`);
  if (g.player.riding) {
    key("Space", true); key("KeyW", true); await wait(2500); key("Space", false); key("KeyW", false);
    const up = g.player.pos.y - heightAt(g.player.pos.x, g.player.pos.z);
    check("əjdaha uçur", up > 4, `hündürlük ${up.toFixed(1)} m`);
    await press("KeyG"); await wait(500);
    const gy = Math.abs(g.player.pos.y - heightAt(g.player.pos.x, g.player.pos.z));
    check("əjdahadan düşmək", !g.player.riding && gy < 0.3 && g.player.flyH === 0, `yerdən ${gy.toFixed(2)} m`);
  }

  // 5) tullanma: Space — qalxır və geri enir
  await press("Space", 60); await wait(150);
  const j = g.player.jumpH; await wait(1500);
  check("tullanma", j > 0.3 && g.player.jumpH === 0, `zirvə ${j.toFixed(2)} m`);

  const fails = res.filter((r) => !r[1]);
  document.title = `TEST ${res.length - fails.length}/${res.length} ` + (fails.length ? "| " + fails.map((r) => `${r[0]}: ${r[2]}`).join("; ") : "ok") +
    " || " + res.filter((r) => r[1]).map((r) => `${r[0]}(${r[2]})`).join("; ");
}
