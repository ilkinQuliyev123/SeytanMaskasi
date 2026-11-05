// Oyun dövrəsi: səhnə, dünya, səma, qəsrlər, oyunçu, dəstə, düşmən ordusu, toplar, HUD, qələbə/məğlubiyyət.
import { Color3, DefaultRenderingPipeline, Engine, GlowLayer, ImageProcessingConfiguration, MeshBuilder, PointLight, Ray, Scene, StandardMaterial, Vector3, type LinesMesh } from "@babylonjs/core";
import { FORTS, UNITS, type ArmySetup, type Fort, type GameMap } from "./data";
import { fortLayout, heightAt, SITES, type FortLayout } from "./logic";
import { Player } from "./player";
import { Sky } from "./sky";
import { spawn, Unit, type Post, type Target } from "./units";
import { buildWorld, DOJO, type Quality } from "./world";
import { buildFort } from "./fort";
import { Cannon } from "./cannon";
import { cannonModel } from "./kit";
import { T } from "../i18n/az";
import { createHud, endScreen, pauseMenu } from "../ui/ui";

export type { Quality };
let lockCanvas: HTMLCanvasElement | null = null;
/** siçan kilidi — brauzer klik tələb edir; xəta oyunu dayandırmasın */
function lockSafe() { const p = lockCanvas?.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); }

/** qəsr qarnizonu: top xidmətçiləri, divar keşikçiləri, darvaza, saray mühafizəsi, patrullar, süvarilər, kənddəki əsgərlər */
function garrison(scene: Scene, f: FortLayout, fort: Fort, n: number) {
  const units: Unit[] = [], cannons: Cannon[] = [], cbase = cannonModel(scene);
  cbase.isVisible = false;
  const mk = (type: string, weapon: string, x: number, z: number, post: Post | null = null) => {
    const u = new Unit(scene, UNITS[type], weapon, new Vector3(x, 0, z), new Vector3(x, 0, z), post);
    u.fort = fort.id; units.push(u);
    return u;
  };
  for (const c of f.cannons) {
    const crew = mk("yeniceri", "musket", c.x - Math.sin(c.face) * 2.2, c.z - Math.cos(c.face) * 2.2, { y: c.y, face: c.face });
    cannons.push(new Cannon(scene, cbase, new Vector3(c.x, c.y, c.z), c.face, crew));
  }
  for (const p of f.posts) {
    if (p.kind === "wall") for (const s of [-1.8, 1.8]) mk(s < 0 ? "yeniceri" : "okcu", s < 0 ? "musket" : "bow", p.x + Math.cos(p.face) * s, p.z - Math.sin(p.face) * s, { y: p.y, face: p.face });
    else if (p.kind === "gate") mk("yeniceri", "musket", p.x, p.z, { y: p.y, face: p.face });
    else mk("ottoman", "scimitar", p.x, p.z);
  }
  const inner: { x: number; z: number }[] = [], st = f.site;
  for (const a of f.streets) for (let r = 28; r < st.R - 5; r += 6) inner.push({ x: st.x + Math.sin(a) * r, z: st.z + Math.cos(a) * r });
  const spots = [...inner, ...f.patrol, ...f.roam], roamA = f.roam.slice(0, 20), roamB = f.roam.slice(20);
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const foot = () => { const r = Math.random(); return r < 0.4 ? ["yeniceri", "musket"] : r < 0.55 ? ["yeniceri", "scimitar"] : r < 0.75 ? ["ottoman", "scimitar"] : ["okcu", "bow"]; };
  for (let i = 0; units.length < n; i++) {
    const r = Math.random();
    if (r < 0.12) mk("sipahi", "scimitar", 0, 0).setRoute(Math.random() < 0.5 ? roamA : roamB); // süvari — çöl kənddə
    else if (r < 0.2) mk("atli_okcu", "bow", 0, 0).setRoute(Math.random() < 0.5 ? roamB : roamA);
    else if (r < 0.42) { const [t, w] = foot(); mk(t, w, 0, 0).setRoute(f.patrol); } // içəridə küçə patrulu
    else { const [t, w] = foot(), s = pick(spots); mk(t, w, s.x + (Math.random() - 0.5) * 4, s.z + (Math.random() - 0.5) * 4); } // yerində/yaxında gəzir
  }
  // mülkilər: küçələrdə gəzən kəndlilər (döyüşmür, güllə dəymir)
  const civs = Array.from({ length: 70 }, (_, i) => {
    const c = new Unit(scene, UNITS[i % 2 ? "mulki" : "mulki2"], "", new Vector3(0, 0, 0), new Vector3(0, 0, 0));
    c.setRoute(i % 3 ? f.patrol : Math.random() < 0.5 ? roamA : roamB);
    return c;
  });
  return { units, cannons, civs };
}

export function runGame(engine: Engine, canvas: HTMLCanvasElement, map: GameMap, setup: ArmySetup, quality: Quality, onExit: () => void, at?: string) {
  lockCanvas = canvas;
  engine.setHardwareScalingLevel(quality === "low" ? 1.6 : 1.1); // aşağı ölçüdə çək — zəif video kart üçün
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const player = new Player(scene, setup.weapons, canvas);
  const sky = new Sky(scene, player.camera, quality, map.startHour ?? 9);
  const { grid, anchors } = buildWorld(scene, quality);

  // qəsrlər və orduları
  const forts = map.forts.map((id) => {
    const fort = FORTS[id], site = SITES.find((s) => s.id === id)!, lay = fortLayout(site, 1);
    const { flagMat } = buildFort(scene, lay, grid, anchors, fort.flag);
    return { fort, lay, flagMat, cleared: false, alarmed: false, ...garrison(scene, lay, fort, setup.enemies) };
  });
  const civs = forts.flatMap((f) => f.civs);
  const enemies = forts.flatMap((f) => f.units), cannons = forts.flatMap((f) => f.cannons);
  const hittable: Target[] = [...enemies, ...cannons];
  if (at) { const f = forts.find((x) => x.fort.id === at) ?? forts[0]; if (f) { const g = f.lay.gate, R = f.lay.site.R + 70; player.pos.set(f.lay.site.x + Math.sin(g) * R, 0, f.lay.site.z + Math.cos(g) * R); player.yaw = g + Math.PI; } }

  // görünüş: kino tonu, bloom, FXAA, vinyet
  const pipe = new DefaultRenderingPipeline("fx", true, scene, [player.camera]);
  pipe.fxaaEnabled = true;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipe.imageProcessing.contrast = 1.3; pipe.imageProcessing.exposure = 1.25;
  pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.4;
  pipe.bloomEnabled = quality === "mid"; pipe.bloomThreshold = 0.6; pipe.bloomWeight = 0.45;
  if (quality === "mid") new GlowLayer("glow", scene, { blurKernelSize: 32 }).intensity = 0.8;

  // fənər işıqları: 2 nöqtə işığı həmişə oyunçuya ən yaxın fənərlərə keçir (işıq limiti + performans)
  const lamps = [0, 1].map((i) => { const l = new PointLight("lamp" + i, Vector3.Zero(), scene); l.diffuse = new Color3(1, 0.62, 0.3); l.specular = Color3.Black(); l.intensity = 1.6; l.range = 28; return l; });

  // dəstə: samuraylar həyətdə, ninjalar dojoda
  const allies: Unit[] = [
    ...spawn(scene, "samurai", setup.samuraiWeapon, setup.samurai, 0, 4, 8),
    ...spawn(scene, "ninja", setup.ninjaWeapon, setup.ninja, DOJO.x, DOJO.z, 6)];
  if (at) for (const a of allies) { a.pos.x += player.pos.x; a.pos.z += player.pos.z - 4; }
  let order: "follow" | "attack" = "follow";

  // güllə/ox izləri (hovuz)
  const tracerMat = new StandardMaterial("tr", scene);
  tracerMat.emissiveColor = new Color3(1, 0.8, 0.4); tracerMat.disableLighting = true;
  const tracers: { l: LinesMesh; t: number }[] = [];
  const shot = (a: Vector3, b: Vector3) => {
    let tr = tracers.find((x) => x.t <= 0);
    if (!tr) {
      if (tracers.length > 40) return;
      tr = { l: MeshBuilder.CreateLines("t", { points: [a, b], updatable: true }, scene), t: 0 };
      tr.l.color = new Color3(1, 0.85, 0.5); tr.l.isPickable = false; tracers.push(tr);
    } else MeshBuilder.CreateLines("t", { points: [a, b], instance: tr.l });
    tr.t = 0.07; tr.l.isVisible = true;
  };
  // divar/ev arxasındakını görmür (AI atəşi üçün)
  const blocked = (a: Vector3, b: Vector3) => {
    const d = b.subtract(a), len = d.length();
    return !!scene.pickWithRay(new Ray(a, d.scaleInPlace(1 / len), len), (m) => !!m.metadata?.solid, true)?.hit;
  };

  let paused = false, ended = false, hudT = 0, slowT = 0, frame = 0, msg = T.briefing, msgT = 9;
  const say = (m: string, t = 3) => { msg = m; msgT = t; };
  const nearestFortGate = (p: Vector3) => {
    const f = forts.filter((x) => !x.cleared).sort((a, b) => Math.hypot(a.lay.site.x - p.x, a.lay.site.z - p.z) - Math.hypot(b.lay.site.x - p.x, b.lay.site.z - p.z))[0];
    if (!f) return null;
    const g = f.lay.gate, r = f.lay.site.R - 12;
    return new Vector3(f.lay.site.x + Math.sin(g) * r, 0, f.lay.site.z + Math.cos(g) * r);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyF" && !paused) {
      order = order === "follow" ? "attack" : "follow";
      for (const a of allies) a.alert = order === "attack" ? nearestFortGate(a.pos) : null;
      say(order === "attack" ? "Dəstə: HÜCUM!" : "Dəstə: məni izlə", 2.5);
    }
  };
  addEventListener("keydown", onKey);
  const lockChange = () => {
    if (document.pointerLockElement !== canvas && !ended && !paused) {
      paused = true;
      pauseMenu(() => { paused = false; hudRebuild(); lockSafe(); }, quit);
    }
  };
  document.addEventListener("pointerlockchange", lockChange);
  const clickLock = () => { if (!paused && !ended) lockSafe(); };
  canvas.addEventListener("click", clickLock);
  let hudRef = createHud();
  const hudRebuild = () => { hudRef.destroy(); hudRef = createHud(); };

  scene.onBeforeRenderObservable.add(() => {
    if (paused || ended) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    frame++;
    sky.update(dt, player.pressed("KeyT"));
    player.update(dt, grid, hittable, shot);
    const pp = player.pos;
    if ((slowT -= dt) <= 0) { // yarım saniyədə bir: məsafələr, görünmə, işıqlar, həyəcan
      slowT = 0.5;
      for (const e of enemies) { e.dist = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z); e.mesh.isVisible = e.dist < 420; }
      anchors.sort((a, b) => Vector3.DistanceSquared(a, pp) - Vector3.DistanceSquared(b, pp));
      lamps.forEach((l, i) => anchors[i] && l.position.copyFrom(anchors[i]));
      for (const f of forts) f.alarmed = f.units.some((u) => u.alive && !!u.target);
    }
    if (player.lastNoise) { // atəş səsi: yalnız ən yaxın 6 düşmən gəlir (ox səssizdir)
      enemies.filter((e) => e.alive && !e.target && !e.post && e.dist < player.lastNoise).sort((a, b) => a.dist - b.dist).slice(0, 6).forEach((e) => (e.alert = pp.clone()));
    }
    const night = sky.isNight, fog = sky.fog;
    allies.forEach((u, i) => u.update(dt, { foes: enemies, night, fog, leader: pp, order, grid, mates: allies, onShot: shot, slot: i, blocked }));
    const foes: Target[] = [player, ...allies];
    for (const f of forts) for (const u of f.units) {
      if (!u.alive) continue;
      const busy = u.target || u.alert;
      if (u.dist > 260 && !busy) continue; // uzaqdakılar «yatır»
      u.acc += dt;
      if (u.dist > 110 && !busy && (frame + (u.hp | 0)) % 4) continue; // orta məsafə — seyrək yenilənir
      u.update(u.acc, { foes, night, fog, leader: pp, order, grid, mates: f.units, onShot: shot, slot: 0, blocked });
      u.acc = 0;
    }
    for (const c of civs) { // mülkilər yalnız yaxında hərəkət edir; döyüş yaxınlaşanda evlərə qaçır (gizlənir)
      if ((frame + (c.hp | 0)) % 3) continue;
      const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
      c.mesh.isVisible = d < 300 && !(forts.some((f) => f.alarmed) && d < 45);
      if (d < 220) c.update(dt * 3, { foes: [], night, fog, leader: pp, order, grid, mates: [], onShot: shot, slot: 0 });
    }
    for (const f of forts) for (const c of f.cannons) if (c.update(dt, foes, f.alarmed, heightAt) === player) say(T.cannonWarn, 2);
    for (const t of tracers) if ((t.t -= dt) <= 0) t.l.isVisible = false;
    msgT -= dt;
    for (const f of forts) if (!f.cleared && f.units.every((u) => !u.alive)) {
      f.cleared = true; say(`${f.fort.name}: ${T.fortCleared}`, 4);
      f.flagMat.diffuseColor = Color3.FromHexString("#b3261e"); f.flagMat.emissiveColor = new Color3(0.3, 0.02, 0.02);
    }
    const left = enemies.filter((e) => e.alive).length;
    if (!left || !player.alive) return finish(!left);
    if ((hudT -= dt) <= 0) {
      hudT = 0.1;
      const g = player.gun, fm = player.watch.active;
      hudRef.update({ hp: player.hp, maxHp: player.maxHp, weapon: g.w.name, ammo: g.ammo, mag: g.w.mag, reloading: g.reloading > 0,
        hour: sky.hour, weather: sky.weather, enemiesLeft: left, enemiesTotal: enemies.length, allies: allies.filter((a) => a.alive).length,
        form: fm ? { name: fm.name, left: player.watch.left, color: fm.color } : null,
        cooldowns: player.watch.forms.map((x, i) => ({ name: (i === player.formIdx ? "▶ " : "") + x.name, cd: player.watch.cd[x.id] ?? 0 })),
        fps: engine.getFps(), msg: msgT > 0 ? msg : "", forts: { cleared: forts.filter((f) => f.cleared).length, total: forts.length }, scope: player.scope });
    }
  });

  function finish(won: boolean) {
    ended = true;
    document.exitPointerLock();
    endScreen(won, quit);
  }
  function quit() {
    removeEventListener("keydown", onKey);
    document.removeEventListener("pointerlockchange", lockChange);
    canvas.removeEventListener("click", clickLock);
    hudRef.destroy();
    engine.stopRenderLoop();
    scene.dispose();
    onExit();
  }
  engine.runRenderLoop(() => scene.render());
  lockSafe();
}
