// Oyun dövrəsi: səhnə, dünya, səma, qəsrlər, oyunçu, dəstə, düşmən ordusu, toplar, HUD, qələbə/məğlubiyyət.
import { Color3, DefaultRenderingPipeline, Engine, GlowLayer, ImageProcessingConfiguration, LoadAssetContainerAsync, MeshBuilder, PointLight, Ray, Scene, SSAO2RenderingPipeline, StandardMaterial, Vector3, type LinesMesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { FORTS, UNITS, type ArmySetup, type Fort, type GameMap } from "./data";
import { fortLayout, HAMLETS, heightAt, roadPoint, SITES, townLayout, type FortLayout } from "./logic";
import { Player } from "./player";
import { Sky } from "./sky";
import { spawn, Unit, type Post, type Target } from "./units";
import { buildWorld, DOJO, type Quality } from "./world";
import { buildFort } from "./fort";
import { Cannon } from "./cannon";
import { cannonModel } from "./kit";
import { CharLib } from "./chars";
import { setChars } from "./units";
import { Sfx } from "./audio";
import { Dragon } from "./dragon";
import { Moto } from "./moto";
import { T } from "../i18n/az";
import { createHud, endScreen, pauseMenu } from "../ui/ui";
import { createWheel } from "../ui/wheel";
import { FORMS } from "./data";

export type { Quality };
const TEST = location.search.includes("test"); // test: proqram renderində kadr az olur — addım böyük
let gameTime = 0;
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
  const civs = Array.from({ length: TEST ? 8 : 70 }, (_, i) => {
    const c = new Unit(scene, UNITS[i % 2 ? "mulki" : "mulki2"], "", new Vector3(0, 0, 0), new Vector3(0, 0, 0));
    c.setRoute(i % 3 ? f.patrol : Math.random() < 0.5 ? roamA : roamB);
    return c;
  });
  return { units, cannons, civs };
}

export async function runGame(engine: Engine, canvas: HTMLCanvasElement, map: GameMap, setup: ArmySetup, quality: Quality, onExit: () => void, at?: string) {
  lockCanvas = canvas;
  const loading = document.createElement("div"); loading.className = "screen loading"; loading.textContent = "Yüklənir…";
  document.getElementById("ui")?.replaceChildren(loading);
  engine.setHardwareScalingLevel(TEST ? 8 : quality === "low" ? 1.6 : 1.1); // aşağı ölçüdə çək — zəif video kart üçün (test: çox kiçik)
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const player = new Player(scene, setup.weapons, canvas);
  // animasiyalı personajlar: yüklənmirsə sadə modellərlə davam edir
  const lib = await CharLib.load(scene).catch((e) => { console.warn("personajlar yüklənmədi", e); return null; });
  setChars(lib);
  if (lib) try { lib.warm(["samurai", "ninja", "yeniceri", "ottoman", "okcu", "mulki", "mulki2", "koylu"]); lib.warmDying(["yeniceri", "ottoman", "okcu"], quality === "low" ? 3 : 4); lib.warmDying(["samurai", "ninja"], 2); } catch { setChars(null); }
  Unit.falling = [];
  if (lib) player.useChar(lib);
  const hq = new URLSearchParams(location.search).get("h"); // yoxlama: ?h=12 — başlanğıc saatı
  const sky = new Sky(scene, player.camera, quality, hq ? Number(hq) : map.startHour ?? 9);
  const { grid, anchors } = buildWorld(scene, quality);

  // qəsrlər və orduları
  const forts = map.forts.map((id) => {
    const fort = FORTS[id], site = SITES.find((s) => s.id === id)!, lay = fortLayout(site, 1);
    const { flagMat } = buildFort(scene, lay, grid, anchors, fort.flag);
    return { fort, lay, flagMat, cleared: false, alarmed: false, ...garrison(scene, lay, fort, setup.enemies) };
  });
  const civs = forts.flatMap((f) => f.civs);
  // yapon kəndliləri: kəndlərdə gəzir; bəziləri yolla kənddən-kəndə gedir
  for (const v of HAMLETS) for (let i = 0; i < 10; i++) {
    const route = Array.from({ length: 10 }, (_, j) => ({ x: v.x + Math.sin(j * 0.63) * (8 + (j % 3) * 5), z: v.z + Math.cos(j * 0.63) * (8 + (j % 3) * 5) }));
    const c = new Unit(scene, UNITS.koylu, "", Vector3.Zero(), Vector3.Zero()); c.setRoute(route); civs.push(c);
  }
  const roadRoute = Array.from({ length: 16 }, (_, j) => roadPoint(SITES[0], 60 + j * 20));
  // məhəllə: dar küçələrdə kəndlilər gəzir, düşmənin bir hissəsi küçələrdə keşik çəkir
  const town = townLayout(), alleys = town.alleys;
  for (let i = 0; i < 40; i++) { const c = new Unit(scene, UNITS[i % 2 ? "mulki" : "mulki2"], "", Vector3.Zero(), Vector3.Zero()); c.setRoute(alleys.slice(Math.floor(Math.random() * (alleys.length - 12))).slice(0, 12)); civs.push(c); }
  if (forts[0]) for (const u of forts[0].units.filter((u) => !u.post && !u.type.mounted).slice(0, Math.floor(forts[0].units.length * 0.3))) {
    const a = alleys[Math.floor(Math.random() * alleys.length)]; // 30% piyada — məhəllədə
    u.relocate(a.x, a.z);
  }
  for (let i = 0; i < 12; i++) { const c = new Unit(scene, UNITS.koylu, "", Vector3.Zero(), Vector3.Zero()); c.setRoute(roadRoute); civs.push(c); }
  const enemies = forts.flatMap((f) => f.units), cannons = forts.flatMap((f) => f.cannons);
  const hittable: Target[] = [...enemies, ...cannons];
  LoadAssetContainerAsync("/assets/models/cannon_01/cannon_01.gltf", scene).then((c) => cannons.forEach((cn) => cn.useModel(c))).catch(() => {}); // real top modeli (yüklənənə qədər sadə model)
  if (at === "hamlet") { const v = HAMLETS[0]; player.pos.set(v.x - 40, 0, v.z); player.yaw = Math.PI / 2; at = "x"; } // yoxlama: yapon kəndi
  else if (at === "town") { const p = roadPoint(SITES[0], 360); player.pos.set(p.x, 0, p.z); player.yaw = 0; at = "x"; }
  else if (at) { const f = forts.find((x) => x.fort.id === at) ?? forts[0]; if (f) { const g = f.lay.gate, R = f.lay.site.R + 70; player.pos.set(f.lay.site.x + Math.sin(g) * R, 0, f.lay.site.z + Math.cos(g) * R); player.yaw = g + Math.PI; } }

  // görünüş: kino tonu, bloom, FXAA, vinyet
  const pipe = new DefaultRenderingPipeline("fx", true, scene, [player.camera]);
  pipe.fxaaEnabled = true;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipe.imageProcessing.contrast = 1.25; pipe.imageProcessing.exposure = 1.6;
  pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.4;
  pipe.bloomEnabled = quality === "mid"; pipe.bloomThreshold = 0.6; pipe.bloomWeight = 0.45;
  pipe.sharpenEnabled = true; pipe.sharpen.edgeAmount = 0.35; // kəskinlik
  pipe.grainEnabled = true; pipe.grain.intensity = 6; pipe.grain.animated = true; // kino dənəsi
  pipe.chromaticAberrationEnabled = true; pipe.chromaticAberration.aberrationAmount = 4; pipe.chromaticAberration.radialIntensity = 0.8;
  if (quality === "mid") {
    new GlowLayer("glow", scene, { blurKernelSize: 32 }).intensity = 0.8;
    const ao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [player.camera]); // künclərdə dərinlik
    ao.radius = 1.5; ao.totalStrength = 1.1; ao.samples = 8; ao.maxZ = 120;
  }

  // fənər işıqları: 2 nöqtə işığı həmişə oyunçuya ən yaxın fənərlərə keçir (işıq limiti + performans)
  const lamps = [0, 1].map((i) => { const l = new PointLight("lamp" + i, Vector3.Zero(), scene); l.diffuse = new Color3(1, 0.62, 0.3); l.specular = Color3.Black(); l.intensity = 1.6; l.range = 28; return l; });

  // dəstə: samuraylar həyətdə, ninjalar dojoda
  const allies: Unit[] = [
    ...spawn(scene, "samurai", setup.samuraiWeapon, setup.samurai, 0, 4, 8),
    ...spawn(scene, "ninja", setup.ninjaWeapon, setup.ninja, DOJO.x, DOJO.z, 6)];
  if (at) for (const a of allies) { a.pos.x += player.pos.x; a.pos.z += player.pos.z - 4; }
  let order: "follow" | "attack" = "follow";
  const dragon = new Dragon(scene, 18, 6, quality === "low" ? 0.5 : 1); // həyətdə yerdə gözləyir (E ilə min)
  const moto = new Moto(scene, player.pos.x + 3, player.pos.z + 3, 0.4); // oyunçunun yanında
  let nearHint = "", flameT = 0;
  let dragonWarn = true;
  Unit.onDeath = (u) => { // səssiz öldürmədə də yaxındakı 3 yoldaş (25 m) meyitə baxmağa gəlir
    if (u.ally || u.type.civ) return;
    enemies.filter((e) => e !== u && e.alive && !e.target && !e.post && Vector3.DistanceSquared(e.pos, u.pos) < 625).slice(0, 3).forEach((e) => (e.alert = u.pos.clone()));
  };
  // vurma işarəsi (hit marker): atəş kimisə vuranda nişangahın ətrafında qısa X
  const hitMark = document.createElement("div");
  hitMark.style.cssText = "position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;opacity:0;transition:opacity .08s;z-index:5;background:linear-gradient(45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%);-webkit-mask:radial-gradient(circle,transparent 6px,#000 7px);mask:radial-gradient(circle,transparent 6px,#000 7px)";
  document.body.appendChild(hitMark);

  // güllə/ox izləri (hovuz)
  const tracerMat = new StandardMaterial("tr", scene);
  tracerMat.emissiveColor = new Color3(1, 0.8, 0.4); tracerMat.disableLighting = true;
  const tracers: { l: LinesMesh; t: number }[] = [];
  let sfxRef: Sfx | null = null;
  const shot = (a: Vector3, b: Vector3, _hit?: boolean, kind = "musket") => {
    const d = Vector3.Distance(a, player.pos);
    if (sfxRef && d > 3 && d < 160 && Math.random() < 0.5) sfxRef.shot((kind === "bow" ? "bow" : "musket"), d);
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
  // saat çarxı: Q basılı — çarx açıq, vaxt yavaşıyır; Q burax — seçilir
  const wheel = createWheel();
  const items = () => FORMS.map((f) => ({ name: f.name, desc: f.desc, color: f.color, cd: player.watch.cd[f.id] ?? 0 }));
  const onWheelKey = (e: KeyboardEvent) => {
    if (e.code !== "KeyQ" || paused || ended) return;
    if (e.type === "keydown" && !e.repeat && !wheel.isOpen()) { wheel.open(items(), player.formIdx); player.wheelOpen = true; }
    if (e.type === "keyup" && wheel.isOpen()) { player.formIdx = wheel.close(); player.wheelOpen = false; say(`${FORMS[player.formIdx].name} — E ilə çevril`, 2); }
  };
  const onWheelMove = (e: MouseEvent) => { if (wheel.isOpen()) wheel.move(e.movementX, e.movementY); };
  addEventListener("keydown", onWheelKey); addEventListener("keyup", onWheelKey); addEventListener("mousemove", onWheelMove);
  // E: motosiklet / əjdaha — min və düş (yaxında heç biri yoxdursa saat çevrilməsi işləyir)
  const dismountDragon = () => {
    const f = dragon.forward, side = new Vector3(f.z, 0, -f.x);
    player.riding = null; dragon.rider = false; player.flyH = 0; player.jumpH = 0; player.jumpV = 0;
    player.pos.copyFrom(dragon.pos.add(side.scale(4.5))); player.pos.y = heightAt(player.pos.x, player.pos.z);
  };
  player.interact = () => {
    if (paused || ended) return false;
    if (player.moto) {
      if (moto.kmh > 25) { say("Əvvəlcə yavaşla (S)", 2); return true; }
      const side = new Vector3(moto.forward.z, 0, -moto.forward.x);
      player.moto = null; moto.rider = false; player.pos.copyFrom(moto.pos.add(side.scale(1.3))); player.pos.y = heightAt(player.pos.x, player.pos.z);
      say("Motosikletdən düşdün", 2); return true;
    }
    if (player.riding) {
      if (!dragon.grounded && dragon.altitude > 2.5) { say("Əvvəlcə yerə en (Ctrl)", 2); return true; }
      dismountDragon(); say("Əjdahadan düşdün", 2); return true;
    }
    if (player.watch.active) return false;
    if (Vector3.Distance(player.pos, moto.pos) < 3.2) {
      player.moto = moto; moto.rider = true; player.yaw = moto.yaw;
      say("Motosiklet: W qaz · S əyləc · A/D sükan · Shift nitro · Sol klik atəş · E düş", 5); return true;
    }
    if (Math.hypot(player.pos.x - dragon.pos.x, player.pos.z - dragon.pos.z) < 7.5 && dragon.alive && dragon.grounded) {
      player.riding = dragon; dragon.rider = true; dragon.summon = null; player.yaw = dragon.yaw;
      say("Əjdaha: W/S yeri · Space uç · Ctrl en · Shift sürət · Sol klik alov · 25 m-dəki düşmənə özü alov püskürür · E düş", 6); return true;
    }
    return false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyG" && !paused) { // əjdahanı yanına çağır (uçub gəlir və yerə enir)
      if (player.riding) say("Əjdahadan düşmək üçün E", 2);
      else if (!dragon.alive) say("Əjdaha yaralıdır, hələ uça bilmir", 2);
      else { dragon.summon = player.pos.clone(); say("Əjdaha gəlir… yanına enəndə E ilə min", 3); }
    }
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
      if (wheel.isOpen()) { player.formIdx = wheel.close(); player.wheelOpen = false; }
      pauseMenu(() => { paused = false; hudRebuild(); lockSafe(); }, quit);
    }
  };
  document.addEventListener("pointerlockchange", lockChange);
  const clickLock = () => { if (!paused && !ended) lockSafe(); };
  canvas.addEventListener("click", clickLock);
  let hudRef = createHud();
  const sfx = (sfxRef = new Sfx()); let ambT = 0, stepT = 0, lastAmmo = -1, lastCur = -1, lastForm = "";
  const unlock = () => sfx.unlock(); canvas.addEventListener("pointerdown", unlock);
  const hudRebuild = () => { hudRef.destroy(); hudRef = createHud(); };

  scene.onBeforeRenderObservable.add(() => {
    if (paused || ended) return;
    const dt = TEST ? 0.06 : Math.min(0.05, engine.getDeltaTime() / 1000) * (wheel.isOpen() ? 0.25 : 1); // çarx açıqkən vaxt yavaşıyır
    gameTime += dt;
    frame++;
    sky.update(dt, player.pressed("KeyT"));
    player.update(dt, grid, hittable, shot);
    const pp = player.pos;
    hitMark.style.opacity = player.hitFlash > 0 ? "1" : "0"; player.hitFlash -= dt;
    // səslər: fon, addımlar, atəş, doldurma, çevrilmə
    if ((ambT -= dt) <= 0) { ambT = 1; sfx.ambience(sky.isNight, sky.weather === "yağış" ? 0.8 : sky.weather === "duman" ? 0.2 : 0.45); }
    const g0 = player.gun, moving = player.pressed("KeyW") || player.pressed("KeyA") || player.pressed("KeyS") || player.pressed("KeyD");
    if (moving && !player.moto && !player.riding && player.jumpH <= 0 && (stepT -= dt) <= 0) { const run = player.pressed("ShiftLeft"); stepT = run ? 0.3 : 0.45; sfx.step(run); }
    if (player.cur === lastCur && g0.ammo < lastAmmo) sfx.shot(g0.w.id as "m16");
    if (player.cur === lastCur && g0.reloading > 0 && g0.ammo === 0 && lastAmmo !== 0) sfx.reload(g0.w.id);
    lastAmmo = g0.ammo; lastCur = player.cur;
    const fid = player.watch.active?.id ?? ""; if (fid !== lastForm) { if (fid) sfx.transform(); lastForm = fid; }
    if ((slowT -= dt) <= 0) { // yarım saniyədə bir: məsafələr, görünmə, işıqlar, həyəcan
      slowT = 0.5;
      for (const e of enemies) { e.dist = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z); e.setLod(e.dist < 90, e.dist < 320); }
      lib?.tick(); lib?.tickDying(performance.now() / 1000);
      for (const a of allies) a.setLod(Math.hypot(a.pos.x - pp.x, a.pos.z - pp.z) < 90, true);
      anchors.sort((a, b) => Vector3.DistanceSquared(a, pp) - Vector3.DistanceSquared(b, pp));
      lamps.forEach((l, i) => anchors[i] && l.position.copyFrom(anchors[i]));
      for (const f of forts) f.alarmed = f.units.some((u) => u.alive && !!u.target);
    }
    if (player.lastNoise) { // atəş səsi: yalnız ən yaxın 6 düşmən gəlir (ox səssizdir)
      enemies.filter((e) => e.alive && !e.target && !e.post && e.dist < player.lastNoise).sort((a, b) => a.dist - b.dist).slice(0, 6).forEach((e) => (e.alert = pp.clone()));
    }
    const night = sky.isNight, fog = sky.fog;
    if (player.watch.active?.id === "qalxan") for (const a of allies) if (a.alive && Vector3.Distance(a.pos, pp) < 10) a.hp = Math.min(a.type.hp, a.hp + 12 * dt); // qalxan dəstəni sağaldır
    allies.forEach((u, i) => u.update(dt, { foes: enemies, night, fog, leader: pp, order, grid, mates: allies, onShot: shot, slot: i, blocked }));
    if (player.riding && !dragon.alive) { dismountDragon(); say("Əjdaha yaralandı və yerə endi!", 3); }
    if (dragon.alive && dragon.hp < 500 && dragonWarn) { dragonWarn = false; say("Əjdaha ağır yaralanıb!", 3); }
    if (!player.riding) dragon.update(dt, pp, hittable, undefined, grid);
    if (!player.moto) moto.update(dt, null, grid); // boş motosiklet sürüşüb dayanır
    sfx.engine(player.moto ? moto.speed : null);
    if (dragon.breathing && (flameT -= dt) <= 0) { flameT = 0.4; sfx.flame(Vector3.Distance(dragon.pos, pp)); }
    Unit.tickFalls(dt);
    if (!player.moto && !player.riding && msgT <= 0) { // yaxınlaşanda ipucu
      const h = Vector3.Distance(pp, moto.pos) < 3.2 ? "E — motosiklete min" : dragon.alive && dragon.grounded && Math.hypot(pp.x - dragon.pos.x, pp.z - dragon.pos.z) < 7.5 ? "E — əjdahaya min" : "";
      if (h && h !== nearHint) say(h, 2.5);
      nearHint = h;
    }
    const foes: Target[] = [player, ...allies, dragon];
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
      c.setLod(d < 70, d < 260 && !(forts.some((f) => f.alarmed) && d < 45));
      if (d < 220) c.update(dt * 3, { foes: [], night, fog, leader: pp, order, grid, mates: [], onShot: shot, slot: 0 });
    }
    for (const f of forts) for (const c of f.cannons) { const t = c.update(dt, foes, f.alarmed, heightAt); if (t) sfx.cannon(Vector3.Distance(c.pos, pp)); if (t === player) say(T.cannonWarn, 2); }
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
      if (wheel.isOpen()) wheel.update(items());
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
    removeEventListener("keydown", onKey); Unit.onDeath = null; Unit.falling = []; sfx.engine(null); player.interact = null;
    canvas.removeEventListener("pointerdown", unlock); sfx.dispose();
    removeEventListener("keydown", onWheelKey); removeEventListener("keyup", onWheelKey); removeEventListener("mousemove", onWheelMove); wheel.destroy();
    document.removeEventListener("pointerlockchange", lockChange);
    canvas.removeEventListener("click", clickLock);
    hudRef.destroy(); player.dispose(); hitMark.remove();
    engine.stopRenderLoop();
    scene.dispose();
    onExit();
  }
  if (TEST) setInterval(() => scene.render(), 60); // test: virtual zamanda rAF işləmir — taymerlə, sabit 0.06 s addım
  else engine.runRenderLoop(() => scene.render());
  if (location.search.includes("test")) (window as unknown as { __game: unknown }).__game = { player, dragon, moto, enemies, allies, grid, forts, state: () => ({ paused, ended, time: gameTime }) };
  lockSafe();
}
