// Brauzerdə real oyun ssenariləri (yalnız ?test rejimində yüklənir). Nəticə səhifə başlığına yazılır:
// "TEST 5/5 ok" və ya "TEST 3/5 | <uğursuz ssenarilər>". Edge headless ilə avtomatik işlədilir.
import { Vector3 } from "@babylonjs/core";
import { heightAt } from "../game/logic";

type G = {
  player: { pos: Vector3; riding: unknown; moto: unknown; yaw: number; pitch: number; flyH: number; jumpH: number; hp: number; interact: (() => boolean) | null };
  dragon: { pos: Vector3; alive: boolean; mode: string; altitude: number; yaw: number; breathing: boolean; summon: unknown };
  moto: { pos: Vector3; kmh: number; yaw: number };
  enemies: { pos: Vector3; alive: boolean; post: unknown; hp: number; anim: string | null; target: unknown; alert: unknown; stun: number; mesh: { position: Vector3; rotation: Vector3 } }[];
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
  // ?test=moto,dragon — yalnız seçilmiş qruplar (boş: hamısı)
  const sel = (new URLSearchParams(location.search).get("test") || "").split(",").filter(Boolean);
  const on = (n: string) => !sel.length || sel.includes(n);
  const E = () => { key("KeyE", true); key("KeyE", false); };

  if (on("base")) {
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
    // 3) oyunçu divardan keçə bilmir
    const f = g.forts[0].lay, a = f.gate + Math.PI / 4, R = f.site.R;
    g.player.pos.set(f.site.x + Math.sin(a) * (R + 6), 0, f.site.z + Math.cos(a) * (R + 6));
    g.player.yaw = a + Math.PI;
    key("KeyW", true); await wait(4000); key("KeyW", false);
    const dIn = Math.hypot(g.player.pos.x - f.site.x, g.player.pos.z - f.site.z);
    check("divardan keçmir", dIn > R - 0.5, `mərkəzdən ${dIn.toFixed(1)} m (divar ${R})`);
  }

  if (on("moto")) {
    // motosiklet: yanına get, E — min, W — sür, S — əyləc, E — düş
    g.player.pos.copyFrom(g.moto.pos.add(new Vector3(1.5, 0, 0)));
    await wait(200); E(); await wait(200);
    check("motosikletə minmək", !!g.player.moto, `məsafə ${Vector3.Distance(g.player.pos, g.moto.pos).toFixed(1)} m`);
    if (g.player.moto) {
      const p0 = g.moto.pos.clone(); g.player.yaw = g.moto.yaw;
      key("KeyW", true); await wait(3000); const v = g.moto.kmh; key("KeyW", false);
      check("motosiklet sürür", Vector3.Distance(p0, g.moto.pos) > 12 && v > 30, `${Vector3.Distance(p0, g.moto.pos).toFixed(1)} m, ${v.toFixed(0)} km/s`);
      key("KeyA", true); key("KeyW", true); const y0 = g.moto.yaw; await wait(1500); key("KeyA", false); key("KeyW", false);
      check("motosiklet dönür", Math.abs(g.moto.yaw - y0) > 0.4, `dönmə ${(g.moto.yaw - y0).toFixed(2)} rad`);
      key("KeyS", true); await wait(2500); key("KeyS", false);
      const ground = Math.abs(g.moto.pos.y - heightAt(g.moto.pos.x, g.moto.pos.z));
      E(); await wait(200);
      check("motosikletdən düşmək", !g.player.moto && ground < 0.3, `sürət ${g.moto.kmh.toFixed(0)} km/s, yerdən ${ground.toFixed(2)} m`);
    }
  }

  if (on("dragon")) {
    // əjdaha: G — uçub gəlir və YERƏ enir (özü mindirmir); E — min; Space — uç; Ctrl — en; E — düş
    g.player.pos.set(0, 0, 20); g.player.yaw = 0;
    await press("KeyG"); await wait(10000);
    const dd = Math.hypot(g.dragon.pos.x - g.player.pos.x, g.dragon.pos.z - g.player.pos.z);
    check("əjdaha çağırılıb yerə enir", g.dragon.mode === "ground" && dd < 8 && !g.player.riding, `məsafə ${dd.toFixed(1)} m, rejim ${g.dragon.mode}`);
    E(); await wait(200);
    check("E ilə əjdahaya minmək", !!g.player.riding, "");
    if (g.player.riding) {
      key("Space", true); key("KeyW", true); await wait(2500); key("Space", false); key("KeyW", false);
      check("əjdaha uçur", g.dragon.altitude > 4, `hündürlük ${g.dragon.altitude.toFixed(1)} m`);
      key("ControlLeft", true); await wait(5000); key("ControlLeft", false); await wait(300);
      check("əjdaha yerə enir", g.dragon.mode === "ground", `hündürlük ${g.dragon.altitude.toFixed(1)} m`);
      E(); await wait(300);
      const gy = Math.abs(g.player.pos.y - heightAt(g.player.pos.x, g.player.pos.z));
      check("əjdahadan düşmək", !g.player.riding && gy < 0.3, `yerdən ${gy.toFixed(2)} m`);
    }
  }

  if (on("fire")) {
    // 4 baş: əjdahanın qarşısında 12–20 m-ə 4 düşmən qoy — hamısını yandırmalıdır (əjdaha yerdə, minilməyib)
    const d = g.dragon, f = new Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)), r = new Vector3(f.z, 0, -f.x);
    const four = g.enemies.filter((e) => e.alive && !e.post).slice(0, 4);
    four.forEach((e, i) => { const p = d.pos.add(f.scale(13 + (i % 2) * 5)).add(r.scale((i - 1.5) * 5)); e.pos.set(p.x, heightAt(p.x, p.z), p.z); e.stun = 6; e.target = null; e.alert = null; });
    g.player.pos.copyFrom(d.pos.add(f.scale(-12)));
    await wait(5000);
    const dead = four.filter((e) => !e.alive).length;
    check("4 baş alov püskürür (25 m)", dead >= 3, `${dead}/4 yandı, alov ${d.breathing}`);
    await wait(3000);
    const lying = four.filter((e) => !e.alive && e.anim === "dead").length, dying = four.filter((e) => !e.alive && Math.abs(e.mesh.rotation.x) > 0.5 || e.anim === "dead").length;
    check("əsgər yıxılır (ölüm animasiyası bitib uzanır)", lying + dying >= dead && dead > 0, `uzanmış ${lying}, cəmi ölən ${dead}`);
    // uzaqdakını yandırmır: 40 m-ə qoy
    const far = g.enemies.find((e) => e.alive && !e.post);
    if (far) { const p = d.pos.add(f.scale(40)); far.pos.set(p.x, heightAt(p.x, p.z), p.z); far.stun = 6; const hp = far.hp; await wait(2500); check("25 m-dən uzaqdakına alov yox", far.alive && far.hp === hp, `can ${far.hp.toFixed(0)}/${hp}`); }
  }

  if (on("jump")) {
    await press("Space", 60); await wait(150);
    const j = g.player.jumpH; await wait(1500);
    check("tullanma", j > 0.3 && g.player.jumpH === 0, `zirvə ${j.toFixed(2)} m`);
  }

  const fails = res.filter((r) => !r[1]);
  document.title = `TEST ${res.length - fails.length}/${res.length} ` + (fails.length ? "| " + fails.map((r) => `${r[0]}: ${r[2]}`).join("; ") : "ok") +
    " || " + res.filter((r) => r[1]).map((r) => `${r[0]}(${r[2]})`).join("; ");
}
