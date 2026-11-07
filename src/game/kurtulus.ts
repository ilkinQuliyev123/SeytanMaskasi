// Qurtuluş Savaşı (1919–1922) — fiktiv komandir. Sübh çağı, günəş dənizdən yarımçıq çıxıb.
// Kənddəki kazarmadan 100 türk əsgəri ilə çıx, 10 səngər xəttini sahilə qədər təmizlə (quruda 3 kazarma — 300 düşmən).
// Dənizdə 9 gəmi (hər birində 50 dənizçi) sahilə atəş açır. Təpələrdəki 6 topla (ən hündürdə böyük sahil topu) onları batır:
// toplar yanında əsgər olanda özü atır; oyunçu E ilə topa keçib özü nişan ala bilər.
import { Color3, Color4, DefaultRenderingPipeline, DynamicTexture, Engine, GlowLayer, ImageProcessingConfiguration, Mesh, MeshBuilder, ParticleSystem,
  PointLight, Ray, Scene, StandardMaterial, TransformNode, Vector3, type InstancedMesh, type LinesMesh } from "@babylonjs/core";
import { UNITS, type ArmySetup, type GameMap } from "./data";
import { heightAt } from "./logic";
import { Player } from "./player";
import { Unit, setChars, type Target } from "./units";
import { Sky } from "./sky";
import { CharLib, hat } from "./chars";
import { Sfx } from "./audio";
import { Kit, glowMat, vcMat } from "./kit";
import { createHud, endScreen, pauseMenu } from "../ui/ui";
import { AREA, buildKurtulus, COAST, ENEMY_BARRACKS, HILLS, OUR_BARRACKS, TRENCH_X } from "./kurtulus_world";
import type { Quality } from "./world";

const TEST = location.search.includes("test") || location.search.includes("map=");
const G = 9.8;
let lockCanvas: HTMLCanvasElement | null = null;
const lockSafe = () => { const p = lockCanvas?.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); };

function puff(scene: Scene, name: string, inner: string, outer: string) {
  const t = new DynamicTexture(name, 64, scene, false), c = t.getContext() as CanvasRenderingContext2D, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update();
  return t;
}

/** partlayış / su sütunu / tüstü effektləri: bir neçə hissəcik sistemi, «manualEmit» ilə */
class Fx {
  private fire: ParticleSystem; private smoke: ParticleSystem; private splash: ParticleSystem; private dirt: ParticleSystem;
  constructor(scene: Scene, low: boolean) {
    const k = low ? 0.6 : 1;
    const mk = (name: string, n: number, tex: DynamicTexture, c1: Color4, c2: Color4, dead: Color4, size: [number, number], life: [number, number], speed: [number, number], grav: number, blend = ParticleSystem.BLENDMODE_STANDARD) => {
      const p = new ParticleSystem(name, Math.ceil(n * k), scene);
      p.particleTexture = tex; p.emitter = Vector3.Zero(); p.emitRate = 0; p.manualEmitCount = 0;
      p.color1 = c1; p.color2 = c2; p.colorDead = dead; p.minSize = size[0]; p.maxSize = size[1]; p.minLifeTime = life[0]; p.maxLifeTime = life[1];
      p.minEmitPower = speed[0]; p.maxEmitPower = speed[1]; p.direction1 = new Vector3(-1, 1, -1); p.direction2 = new Vector3(1, 2.2, 1);
      p.gravity = new Vector3(0, grav, 0); p.blendMode = blend; p.minAngularSpeed = -1; p.maxAngularSpeed = 1; p.updateSpeed = 0.02;
      p.start(); return p;
    };
    const soft = puff(scene, "fxSoft", "rgba(255,255,255,1)", "rgba(255,255,255,0)");
    this.fire = mk("fxFire", 220, puff(scene, "fxFireT", "rgba(255,230,160,1)", "rgba(255,90,0,0)"), new Color4(1, 0.75, 0.3, 1), new Color4(1, 0.45, 0.1, 1), new Color4(0.3, 0.1, 0, 0), [2, 6], [0.25, 0.6], [4, 14], -2, ParticleSystem.BLENDMODE_ADD);
    this.smoke = mk("fxSmoke", 260, soft, new Color4(0.22, 0.2, 0.18, 0.75), new Color4(0.35, 0.32, 0.3, 0.6), new Color4(0.4, 0.38, 0.36, 0), [5, 12], [2.5, 5], [1, 4], 1.2);
    this.splash = mk("fxSplash", 300, soft, new Color4(0.92, 0.95, 1, 0.9), new Color4(0.75, 0.82, 0.9, 0.8), new Color4(0.8, 0.85, 0.9, 0), [1.5, 3.5], [1.4, 2.4], [14, 26], -12);
    this.splash.direction1 = new Vector3(-0.25, 1, -0.25); this.splash.direction2 = new Vector3(0.25, 1, 0.25);
    this.dirt = mk("fxDirt", 200, soft, new Color4(0.3, 0.24, 0.17, 0.95), new Color4(0.22, 0.18, 0.12, 0.9), new Color4(0.2, 0.17, 0.12, 0), [1, 2.5], [0.8, 1.6], [8, 16], -14);
  }
  private emit(p: ParticleSystem, at: Vector3, n: number) { (p.emitter as Vector3).copyFrom(at); p.manualEmitCount = n; }
  boom(at: Vector3, big = 1) { this.emit(this.fire, at, 30 * big); this.emit(this.smoke, at, 14 * big); this.emit(this.dirt, at, 35 * big); }
  water(at: Vector3, big = 1) { this.emit(this.splash, new Vector3(at.x, 0.3, at.z), 70 * big); }
  muzzle(at: Vector3) { this.emit(this.fire, at, 10); this.emit(this.smoke, at, 6); }
}

// --- gəmi: 1919 tipli zirehli gəmi (orijinal low-poly model) ---
function shipModel(scene: Scene): Mesh {
  const k = new Kit(scene), GR = "#5f676e", DK = "#3d4349", DECK = "#8a7a62";
  k.box(10, 6.5, 70, GR, [0, 0.25, 0]).box(7.07, 6.5, 7.07, GR, [0, 0.25, 35], [0, Math.PI / 4, 0]).cyl(6.5, 10, 10, GR, [0, 0.25, -35], undefined, 14)
    .box(10.15, 0.7, 70.2, "#6a2420", [0, -0.8, 0]).box(9.7, 0.18, 74, DECK, [0, 3.55, 0])
    .box(7, 4, 15, GR, [0, 5.6, 5]).box(8.2, 2.4, 5, DK, [0, 8.8, 10]).box(9, 0.3, 6, GR, [0, 10.1, 10])
    .cyl(9, 2.6, 3, "#2c2f33", [0, 10, -1.5], undefined, 10).cyl(9, 2.6, 3, "#2c2f33", [0, 10, -8.5], undefined, 10)
    .cyl(0.8, 2.7, 2.7, "#111111", [0, 14.6, -1.5], undefined, 10).cyl(0.8, 2.7, 2.7, "#111111", [0, 14.6, -8.5], undefined, 10)
    .cyl(24, 0.3, 0.55, "#3a3c40", [0, 15, 15], undefined, 6).cyl(19, 0.25, 0.45, "#3a3c40", [0, 12.5, -20], undefined, 6).box(7, 0.25, 0.25, "#3a3c40", [0, 21, 15]);
  for (const [z, dir] of [[23, 1], [-25, -1]] as const) { // əsas qüllələr
    k.cyl(2.4, 6, 6.4, GR, [0, 4.9, z], undefined, 12).box(5, 1.8, 5.5, DK, [0, 6.4, z]);
    for (const s of [-0.9, 0.9]) k.cyl(9, 0.35, 0.5, "#2c2f33", [s, 6.4, z + dir * 6.5], [Math.PI / 2, 0, 0], 6);
  }
  for (const s of [-1, 1]) for (const z of [-12, -4, 18]) k.box(1.2, 1, 2, DK, [s * 5.3, 2.6, z]).cyl(3, 0.18, 0.22, "#2c2f33", [s * 6.6, 2.6, z], [0, 0, Math.PI / 2], 5);
  const m = k.build("ship", vcMat(scene, "vcShip", 0.3));
  m.isVisible = false;
  return m;
}

class Ship {
  hp = 100; crew = 50; sink = 0; cool = 20 + Math.random() * 25; bob = Math.random() * 6;
  mesh: InstancedMesh; smoke: ParticleSystem;
  constructor(scene: Scene, base: Mesh, public pos: Vector3, public yaw: number, smokeTex: DynamicTexture, low: boolean) {
    this.mesh = base.createInstance("shipI"); this.mesh.position.copyFrom(pos); this.mesh.rotation.y = yaw; this.mesh.metadata = { solid: true };
    const p = (this.smoke = new ParticleSystem("shipSmoke", low ? 30 : 60, scene));
    p.particleTexture = smokeTex; p.emitter = pos.add(new Vector3(0, 15, 0)); p.emitRate = low ? 4 : 8;
    p.minSize = 4; p.maxSize = 9; p.minLifeTime = 5; p.maxLifeTime = 9; p.minEmitPower = 0.5; p.maxEmitPower = 1.5;
    p.direction1 = new Vector3(-0.3, 1, 0.6); p.direction2 = new Vector3(0.3, 1.4, 1.2);
    p.color1 = new Color4(0.12, 0.12, 0.13, 0.55); p.color2 = new Color4(0.2, 0.2, 0.21, 0.45); p.colorDead = new Color4(0.3, 0.3, 0.32, 0);
    p.start();
  }
  get alive() { return this.hp > 0; }
  /** gəminin içindədirmi (yerli koordinatda qutu) */
  contains(p: Vector3) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return Math.abs(lx) < 6.5 && Math.abs(lz) < 41 && p.y < 16 && p.y > -4;
  }
  damage(d: number) { this.hp = Math.max(0, this.hp - d); this.crew = Math.ceil((50 * this.hp) / 100); }
  update(dt: number) {
    this.bob += dt;
    if (this.alive) { this.mesh.position.y = Math.sin(this.bob * 0.7) * 0.25; this.mesh.rotation.z = Math.sin(this.bob * 0.5) * 0.02; this.mesh.rotation.x = Math.sin(this.bob * 0.43) * 0.008; return; }
    this.sink += dt; // batır: yana əyilir və suya gedir
    this.mesh.position.y = -this.sink * 0.35; this.mesh.rotation.z = Math.min(0.55, this.sink * 0.03); this.mesh.rotation.x = Math.min(0.15, this.sink * 0.006);
    (this.smoke.emitter as Vector3).y = Math.max(1, 15 - this.sink * 0.4); this.smoke.emitRate = this.sink < 40 ? 22 : 0;
    this.smoke.color1 = new Color4(0.08, 0.08, 0.08, 0.7);
    if (this.sink > 55) this.mesh.setEnabled(false);
  }
}

// --- təpə topları: sahə topu (5) və böyük sahil topu (1) ---
class HillGun {
  yaw = Math.PI / 2; elev = 0.08; cool = 4; root: TransformNode; turret: TransformNode; barrel: TransformNode; muzzleLen: number;
  constructor(scene: Scene, public pos: Vector3, public big: boolean) {
    const mat = vcMat(scene, "vcGun", 0.4);
    this.root = new TransformNode("gun", scene); this.root.position.copyFrom(pos);
    this.turret = new TransformNode("gunT", scene); this.turret.parent = this.root;
    this.barrel = new TransformNode("gunB", scene); this.barrel.parent = this.turret;
    const base = new Kit(scene), tur = new Kit(scene), bar = new Kit(scene), OL = "#4a5038", CON = "#8a877e";
    if (big) {
      base.cyl(1.2, 9, 9.6, CON, [0, 0.6, 0], undefined, 16).cyl(1.4, 11, 11.4, "#9a8a64", [0, 0.7, 0], undefined, 18, [1, 1, 1]);
      tur.cyl(0.8, 5, 5, "#3e4436", [0, 1.6, 0], undefined, 14).box(1, 2.6, 3, OL, [-1.4, 3, 0]).box(1, 2.6, 3, OL, [1.4, 3, 0]).box(4, 3, 0.3, OL, [0, 3.2, 1.8]);
      bar.cyl(12, 0.55, 0.85, "#2c3028", [0, 0, 5], [Math.PI / 2, 0, 0], 10).box(1.4, 1.4, 2.2, "#2c3028", [0, 0, -1.4]).cyl(0.6, 0.75, 0.75, "#24261f", [0, 0, 11], [Math.PI / 2, 0, 0], 10);
      this.barrel.position.set(0, 3.4, 0); this.muzzleLen = 11.5;
    } else {
      base.box(5, 0.6, 5, "#9a8a64", [0, 0.3, 0]);
      tur.cyl(0.18, 1.35, 1.35, "#3a2a1a", [-0.85, 0.68, 0], [0, 0, Math.PI / 2], 12).cyl(0.18, 1.35, 1.35, "#3a2a1a", [0.85, 0.68, 0], [0, 0, Math.PI / 2], 12)
        .cyl(1.8, 0.1, 0.1, "#2a2a2a", [0, 0.68, 0], [0, 0, Math.PI / 2], 6).box(2.1, 1.3, 0.07, OL, [0, 1.25, 0.35]).box(0.35, 0.25, 2.6, OL, [0, 0.4, -1.5], [-0.2, 0, 0]);
      bar.cyl(3.2, 0.16, 0.22, "#2c3028", [0, 0, 1.3], [Math.PI / 2, 0, 0], 8).box(0.4, 0.4, 0.9, "#2c3028", [0, 0, -0.35]);
      this.barrel.position.set(0, 1.15, 0.1); this.muzzleLen = 2.9;
    }
    const bm = base.build("gunBase", mat); bm.parent = this.root; bm.isPickable = false;
    const tm = tur.build("gunTur", mat); tm.parent = this.turret; tm.isPickable = false;
    const brm = bar.build("gunBar", mat); brm.parent = this.barrel; brm.isPickable = false;
    this.apply();
  }
  apply() { this.turret.rotation.y = this.yaw; this.barrel.rotation.x = -this.elev; }
  get dir() { return new Vector3(Math.sin(this.yaw) * Math.cos(this.elev), Math.sin(this.elev), Math.cos(this.yaw) * Math.cos(this.elev)); }
  get muzzle() { return this.pos.add(new Vector3(0, this.barrel.position.y, 0)).add(this.dir.scale(this.muzzleLen)); }
  get speed() { return this.big ? 230 : 160; } // m/s (oyun üçün sadələşdirilmiş)
  get range() { return this.big ? 3000 : 1800; }
  get reload() { return this.big ? 6 : 9; }
}

type Shell = { p: Vector3; v: Vector3; m: Mesh; dmg: number; r: number; enemy: boolean; ring: Mesh | null; life: number; big: boolean };

export async function runKurtulus(engine: Engine, canvas: HTMLCanvasElement, map: GameMap, setup: ArmySetup, quality: Quality, onExit: () => void) {
  lockCanvas = canvas;
  const loading = document.createElement("div"); loading.className = "screen loading"; loading.textContent = "Yüklənir…";
  document.getElementById("ui")?.replaceChildren(loading);
  engine.setHardwareScalingLevel(location.search.includes("test") ? 8 : TEST ? 3 : quality === "low" ? 1.6 : 1.1);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const low = quality === "low";
  const player = new Player(scene, setup.weapons.length ? setup.weapons : ["sniper", "m16"], canvas);
  player.hp = player.maxHp = 300;
  const lib = await CharLib.load(scene).catch((e) => { console.warn("personajlar yüklənmədi", e); return null; });
  setChars(lib);
  if (lib) try { lib.warm(["turk", "isgalci"]); lib.warmDying(["isgalci"], low ? 4 : 6); lib.warmDying(["turk"], 3); } catch { setChars(null); }
  Unit.falling = []; Unit.onDeath = null;
  if (lib) player.useChar(lib, { tint: "#6e6646", head: hat.kabalak });
  player.camera.maxZ = 6000; player.camera.minZ = 0.4;
  const sky = new Sky(scene, player.camera, quality, map.startHour ?? 6.05);
  sky.fixedWeather = true; sky.weather = "aydın"; sky.speed = 1 / 900; // sübh uzun sürür (1 saat = 15 dəq)
  { const dome = scene.getMeshByName("dome"); if (dome) dome.scaling.setAll(2.8); } // dəniz üfüqü günbəzin içində qalsın
  const { grid, anchors, posts, sea } = buildKurtulus(scene, quality);

  // günəş: dənizdən yarımçıq çıxıb (aşağı yarısı dənizin arxasında qalır)
  const sunDisc = MeshBuilder.CreatePlane("sunDisc", { size: 430 }, scene), halo = MeshBuilder.CreatePlane("sunHalo", { size: 1900 }, scene);
  for (const [m, a, b] of [[sunDisc, "rgba(255,246,214,1)", "rgba(255,170,60,1)"], [halo, "rgba(255,170,90,0.55)", "rgba(255,120,60,0)"]] as const) {
    const t = new DynamicTexture(m.name + "T", 256, scene, false), c = t.getContext() as CanvasRenderingContext2D, g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    if (m === sunDisc) { g.addColorStop(0, a); g.addColorStop(0.9, b); g.addColorStop(1, "rgba(255,150,50,0)"); } else { g.addColorStop(0, a); g.addColorStop(1, b); }
    c.fillStyle = g; c.fillRect(0, 0, 256, 256); t.hasAlpha = true; t.update();
    const mm = new StandardMaterial(m.name + "M", scene); mm.emissiveTexture = t; mm.opacityTexture = t; mm.disableLighting = true; mm.fogEnabled = false;
    m.material = mm; m.isPickable = false; m.billboardMode = Mesh.BILLBOARDMODE_ALL;
  }
  halo.renderingGroupId = 0; sunDisc.renderingGroupId = 0;
  const sunDir = new Vector3(1, 0, 0.3).normalize();

  // görünüş
  const pipe = new DefaultRenderingPipeline("fx", true, scene, [player.camera]);
  pipe.fxaaEnabled = true; pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true; pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipe.imageProcessing.contrast = 1.2; pipe.imageProcessing.exposure = 1.45;
  pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.2;
  pipe.bloomEnabled = !low; pipe.bloomThreshold = 0.65; pipe.bloomWeight = 0.5;
  pipe.sharpenEnabled = true; pipe.sharpen.edgeAmount = 0.3;
  pipe.grainEnabled = true; pipe.grain.intensity = 5; pipe.grain.animated = true;
  if (!low) new GlowLayer("glow", scene, { blurKernelSize: 32 }).intensity = 0.6;
  const lamp = new PointLight("lamp", Vector3.Zero(), scene); lamp.diffuse = new Color3(1, 0.62, 0.3); lamp.specular = Color3.Black(); lamp.intensity = 1.2; lamp.range = 22;
  const fx = new Fx(scene, low);

  // --- ordular ---
  const nAllies = setup.soldiers ?? 100, nEnemy = setup.enemies || 300;
  const allies: Unit[] = Array.from({ length: nAllies }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10, x = OUR_BARRACKS.x + 12 + row * 2.2, z = OUR_BARRACKS.z - 10 + col * 2.2;
    return new Unit(scene, UNITS.turk, "mauser", new Vector3(x, 0, z), new Vector3(x, 0, z));
  });
  player.bounds = { x0: AREA.x0 + 60, x1: COAST + 12, z0: AREA.z0 + 60, z1: AREA.z1 - 60 }; // 10×5 km meydan; dənizə girmək olmur
  player.pos.set(OUR_BARRACKS.x + 9, 0, OUR_BARRACKS.z); player.yaw = Math.PI / 2; player.pitch = 0.05;
  { const at = new URLSearchParams(location.search).get("at"); // yoxlama: ?at=coast | hill | trench
    if (at === "coast") { player.pos.set(COAST - 25, 0, 40); player.yaw = Math.PI / 2 + 0.25; }
    if (at === "hill") { player.pos.set(HILLS[0].x - 12, 0, HILLS[0].z + 4); player.yaw = Math.PI / 2 - 0.1; player.pitch = 0.12; }
    if (at === "trench") { player.pos.set(TRENCH_X[2] - 40, 0, 20); player.yaw = Math.PI / 2; } }
  const enemies: Unit[] = [];
  const trenchOf = (bi: number) => TRENCH_X.map((x, i) => ({ x, i })).filter(({ x }) => ENEMY_BARRACKS.reduce((b, q, j) => (Math.abs(q.x - x) < Math.abs(ENEMY_BARRACKS[b].x - x) ? j : b), 0) === bi).map((t) => t.i);
  ENEMY_BARRACKS.forEach((b, bi) => {
    const n = Math.round(nEnemy / 3), inTrench = Math.round(n * 0.6), ts = trenchOf(bi);
    for (let j = 0; j < inTrench; j++) { // səngər müdafiəçiləri: yerində dayanıb qərbə atəş açır
      const tr = posts[ts[j % ts.length]], k = Math.floor(j / ts.length), per = Math.ceil(inTrench / ts.length);
      const p = tr[Math.floor(((k + 0.5) / per) * tr.length) % tr.length];
      const u = new Unit(scene, UNITS.isgalci, "mauser", new Vector3(p.x, 0, p.z), new Vector3(p.x, 0, p.z), { y: heightAt(p.x, p.z), face: -Math.PI / 2 });
      u.fort = "t" + p.trench; enemies.push(u);
    }
    for (let j = inTrench; j < n; j++) { // kazarmada: ətrafda gəzir, həyəcanda gəlir
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 12, x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
      const u = new Unit(scene, UNITS.isgalci, "mauser", new Vector3(x, 0, z), new Vector3(b.x + 18, 0, b.z)); u.fort = "b" + bi; enemies.push(u);
    }
  });
  // donanma: 9 gəmi sahildən 250–500 m aralıda, sahilə paralel
  const shipBase = shipModel(scene), smokeTex = puff(scene, "shipSmokeT", "rgba(255,255,255,1)", "rgba(255,255,255,0)");
  const ships = Array.from({ length: 9 }, (_, i) => new Ship(scene, shipBase, new Vector3(COAST + 260 + (i % 3) * 120 + Math.random() * 40, 0, -560 + i * 140), (i % 2 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.15, smokeTex, low));
  // təpə topları
  const guns = HILLS.map((h) => { const y = heightAt(h.x, h.z); return new HillGun(scene, new Vector3(h.x, y - 0.2, h.z), !!h.big); });

  // --- mərmilər ---
  const shellMat = new StandardMaterial("shellM", scene); shellMat.emissiveColor = new Color3(1, 0.7, 0.3); shellMat.disableLighting = true;
  const ringMat = new StandardMaterial("ringM", scene); ringMat.emissiveColor = new Color3(1, 0.15, 0.1); ringMat.disableLighting = true; ringMat.alpha = 0.55;
  const shells: Shell[] = [];
  const sfx = new Sfx();
  const fire = (from: Vector3, v: Vector3, dmg: number, r: number, enemy: boolean, big: boolean, warnAt: Vector3 | null) => {
    const m = MeshBuilder.CreateSphere("shell", { diameter: big ? 0.9 : 0.5, segments: 4 }, scene); m.material = shellMat; m.isPickable = false; m.position.copyFrom(from);
    let ring: Mesh | null = null;
    if (warnAt) { ring = MeshBuilder.CreateTorus("warn", { diameter: r * 2, thickness: 0.4, tessellation: 24 }, scene); ring.material = ringMat; ring.isPickable = false; ring.position.set(warnAt.x, heightAt(warnAt.x, warnAt.z) + 0.4, warnAt.z); }
    shells.push({ p: from.clone(), v, m, dmg, r, enemy, ring, life: 40, big });
    fx.muzzle(from);
    sfx.cannon(Vector3.Distance(from, player.pos) * (big ? 0.6 : 1));
  };
  /** T saniyədə b nöqtəsinə düşən başlanğıc sürəti */
  const lob = (a: Vector3, b: Vector3, T: number) => new Vector3((b.x - a.x) / T, (b.y - a.y + 0.5 * G * T * T) / T, (b.z - a.z) / T);
  const explode = (s: Shell, at: Vector3, water: boolean) => {
    if (water) fx.water(at, s.big ? 1.6 : 1); else fx.boom(at, s.big ? 1.6 : 1);
    sfx.cannon(Vector3.Distance(at, player.pos) * 0.8);
    const foes: Target[] = s.enemy ? [player, ...allies] : enemies;
    for (const t of foes) { const d = Vector3.Distance(t.pos, at); if (t.alive && d < s.r) t.hit(s.dmg * (1 - d / (s.r + 1)), at); }
  };
  const updateShells = (dt: number) => {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.v.y -= G * dt; s.p.addInPlace(s.v.scale(dt)); s.m.position.copyFrom(s.p); s.life -= dt;
      let done = false;
      if (!s.enemy) for (const sh of ships) if (sh.alive && sh.contains(s.p)) {
        sh.damage(s.big ? 30 + Math.random() * 10 : 9 + Math.random() * 5); fx.boom(s.p, 1.4); sfx.cannon(Vector3.Distance(s.p, player.pos) * 0.7); done = true;
        if (!sh.alive) say(`Gəmi batır! (${ships.filter((x) => !x.alive).length}/9)`, 4);
        else if (Math.random() < 0.4) say(`Gəmiyə dəydi! Dənizçi: ${sh.crew}`, 2);
        break;
      }
      if (!done && s.p.y < 0 && s.p.x > COAST - 15) { explode(s, s.p, true); done = true; }
      else if (!done && s.p.y < heightAt(s.p.x, s.p.z)) { explode(s, s.p, false); done = true; }
      if (done || s.life <= 0) { s.m.dispose(); s.ring?.dispose(); shells.splice(i, 1); }
    }
  };

  // --- güllə izləri ---
  const tracers: { l: LinesMesh; t: number }[] = [];
  const shot = (a: Vector3, b: Vector3, _hit?: boolean, kind = "musket") => {
    const d = Vector3.Distance(a, player.pos);
    if (d > 3 && d < 180 && Math.random() < 0.35) sfx.shot(kind === "bow" ? "bow" : "musket", d);
    let tr = tracers.find((x) => x.t <= 0);
    if (!tr) { if (tracers.length > 50) return; tr = { l: MeshBuilder.CreateLines("t", { points: [a, b], updatable: true }, scene), t: 0 }; tr.l.color = new Color3(1, 0.85, 0.5); tr.l.isPickable = false; tracers.push(tr); }
    else MeshBuilder.CreateLines("t", { points: [a, b], instance: tr.l });
    tr.t = 0.06; tr.l.isVisible = true;
  };
  const blocked = (a: Vector3, b: Vector3) => { const d = b.subtract(a), len = d.length(); return !!scene.pickWithRay(new Ray(a, d.scaleInPlace(1 / len), len), (m) => !!m.metadata?.solid, true)?.hit; };

  // --- idarəetmə ---
  let paused = false, ended = false, hudT = 0, slowT = 0, frame = 0, msgT = 10, gameTime = 0, battle = false, order: "follow" | "attack" = "follow";
  let msg = "Sübh çağıdır. Kazarmadan çıx, şərqdəki 10 səngər xəttini sahilə qədər təmizlə. G — 3 əsgəri ən yaxın topa göndər (toplar gəmiləri vurur), F — hücum/izlə, E — topa keç.";
  function say(m: string, t = 3) { msg = m; msgT = t; }
  let manning: HillGun | null = null, aimRing: Mesh | null = null;
  const nearestGun = (p: Vector3, max: number) => guns.map((g) => ({ g, d: Vector3.Distance(g.pos, p) })).filter((x) => x.d < max).sort((a, b) => a.d - b.d)[0]?.g ?? null;
  const crewOf = (g: HillGun) => allies.filter((a) => a.alive && a.hold && Vector3.Distance(a.hold, g.pos) < 12);
  player.interact = () => {
    if (paused || ended) return true;
    if (manning) { manning = null; aimRing?.setEnabled(false); say("Topdan çıxdın", 2); return true; }
    const g = nearestGun(player.pos, 6);
    if (g) { manning = g; player.yaw = g.yaw; player.pitch = -g.elev; say((g.big ? "Böyük sahil topu" : "Sahə topu") + ": siçanla nişan al · sol klik atəş · sağ klik yaxınlaşdır · E çıx", 6); }
    return true; // saat bu xəritədə yoxdur
  };
  const onKey = (e: KeyboardEvent) => {
    if (paused || ended || e.repeat) return;
    if (e.code === "KeyF") { order = order === "follow" ? "attack" : "follow"; for (const a of allies) if (!a.hold) a.alert = null; say(order === "attack" ? "Dəstə: HÜCUM! Süngü taxın!" : "Dəstə: məni izlə", 2.5); }
    if (e.code === "KeyG") {
      const g = guns.filter((x) => crewOf(x).length < 3).sort((a, b) => Vector3.Distance(a.pos, player.pos) - Vector3.Distance(b.pos, player.pos))[0];
      if (!g) { say("Bütün toplarda heyət var", 2); return; }
      const free = allies.filter((a) => a.alive && !a.hold).sort((a, b) => Vector3.Distance(a.pos, g.pos) - Vector3.Distance(b.pos, g.pos)).slice(0, 3 - crewOf(g).length);
      free.forEach((a, i) => { const an = i * 2.1 + 2.4; a.hold = g.pos.add(new Vector3(Math.sin(an) * (g.big ? 7 : 3.2), 0, Math.cos(an) * (g.big ? 7 : 3.2))); });
      say(`${free.length} əsgər ${g.big ? "böyük topa" : "topa"} gedir (${Math.round(Vector3.Distance(g.pos, player.pos))} m)`, 3);
    }
    if (e.code === "KeyH") { for (const a of allies) a.hold = null; say("Top heyətləri geri çağırıldı", 2); }
  };
  addEventListener("keydown", onKey);
  const lockChange = () => { if (document.pointerLockElement !== canvas && !ended && !paused) { paused = true; pauseMenu(() => { paused = false; hudRebuild(); lockSafe(); }, quit); } };
  document.addEventListener("pointerlockchange", lockChange);
  const clickLock = () => { if (!paused && !ended) lockSafe(); };
  canvas.addEventListener("click", clickLock);
  const unlock = () => sfx.unlock(); canvas.addEventListener("pointerdown", unlock);
  const hitMark = document.createElement("div");
  hitMark.style.cssText = "position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;opacity:0;transition:opacity .08s;z-index:5;background:linear-gradient(45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%)";
  document.body.appendChild(hitMark);
  let hudRef = createHud("Gəmilər");
  const hudRebuild = () => { hudRef.destroy(); hudRef = createHud("Gəmilər"); };
  let ambT = 0, stepT = 0, lastAmmo = -1, lastCur = -1, seaT = 0;

  /** topda: kamera lülənin arxasında, siçan lüləni fırladır; düşəcəyi yer sarı halqa ilə göstərilir */
  const gunControl = (dt: number) => {
    const g = manning!;
    g.yaw = player.yaw; g.elev = Math.max(-0.08, Math.min(0.75, -player.pitch)); g.apply();
    const fwd = new Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw)), zoom = player.aiming;
    const cam = g.pos.add(new Vector3(0, g.big ? 6.5 : 2.6, 0)).add(fwd.scale(g.big ? -10 : -4.5));
    player.camera.position.copyFrom(cam);
    player.camera.fov += ((zoom ? 0.3 : 0.95) - player.camera.fov) * Math.min(1, dt * 10);
    player.camera.setTarget(cam.add(g.dir.scale(60)));
    // trayektoriya: düşmə nöqtəsi
    const p = g.muzzle, v = g.dir.scale(g.speed);
    let hit: Vector3 | null = null;
    for (let t = 0; t < 40; t += 0.08) {
      v.y -= G * 0.08; p.addInPlace(v.scale(0.08));
      if ((p.y < 0 && p.x > COAST - 15) || p.y < heightAt(p.x, p.z) || ships.some((s) => s.alive && s.contains(p))) { hit = p; break; }
    }
    if (!aimRing) { aimRing = MeshBuilder.CreateTorus("aimRing", { diameter: 14, thickness: 0.8, tessellation: 24 }, scene); aimRing.material = glowMat(scene, "#ffd84a", "aimGlow"); aimRing.isPickable = false; }
    aimRing.setEnabled(!!hit); if (hit) aimRing.position.set(hit.x, Math.max(0.3, hit.y + 0.3), hit.z);
    g.cool -= dt;
    if (player.shooting && document.pointerLockElement === canvas && g.cool <= 0) { g.cool = g.reload * 0.6; fire(g.muzzle, g.dir.scale(g.speed), g.big ? 140 : 90, g.big ? 9 : 6, false, g.big, null); }
  };

  scene.onBeforeRenderObservable.add(() => {
    if (paused || ended) return;
    const dt = location.search.includes("test") ? 0.06 : Math.min(0.05, engine.getDeltaTime() / 1000);
    gameTime += dt; frame++;
    sky.update(dt, player.pressed("KeyT"));
    if (manning) gunControl(dt); else player.update(dt, grid, enemies, shot);
    if (player.atBorder && msgT <= 0) say(player.pos.x >= COAST ? "Dəniz — buradan o yana keçmək olmur" : "Döyüş meydanının sərhədi (10 × 5 km)", 2);
    const pp = player.pos;
    hitMark.style.opacity = player.hitFlash > 0 ? "1" : "0"; player.hitFlash -= dt;
    // günəş: kameradan 5200 m, sahil istiqamətində; yavaş qalxır
    const rise = (sky.hour - 6.05) * 900;
    sunDisc.position.copyFrom(player.camera.position.add(sunDir.scale(5200))); sunDisc.position.y = rise;
    halo.position.copyFrom(player.camera.position.add(sunDir.scale(5300))); halo.position.y = rise + 40;
    sea.tex.uOffset += dt * 0.004; sea.tex.vOffset += dt * 0.0025;
    // səslər
    if ((ambT -= dt) <= 0) { ambT = 1; sfx.ambience(false, 0.5); }
    const g0 = player.gun, moving = !manning && (player.pressed("KeyW") || player.pressed("KeyA") || player.pressed("KeyS") || player.pressed("KeyD"));
    if (moving && player.jumpH <= 0 && (stepT -= dt) <= 0) { const run = player.pressed("ShiftLeft"); stepT = run ? 0.3 : 0.45; sfx.step(run); }
    if (player.cur === lastCur && g0.ammo < lastAmmo) sfx.shot(g0.w.id as "m16");
    if (player.cur === lastCur && g0.reloading > 0 && g0.ammo === 0 && lastAmmo !== 0) sfx.reload(g0.w.id);
    lastAmmo = g0.ammo; lastCur = player.cur;
    if ((seaT -= dt) <= 0) { seaT = 0.5; } // (dalğa səsi: ambience)

    if ((slowT -= dt) <= 0) {
      slowT = 0.5;
      for (const e of enemies) { e.dist = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z); e.setLod(e.dist < 90, e.dist < 520); }
      for (const a of allies) a.setLod(Math.hypot(a.pos.x - pp.x, a.pos.z - pp.z) < 90, true);
      lib?.tick(); lib?.tickDying(performance.now() / 1000);
      anchors.sort((a, b) => Vector3.DistanceSquared(a, pp) - Vector3.DistanceSquared(b, pp)); if (anchors[0]) lamp.position.copyFrom(anchors[0]);
      if (!battle && (pp.x > TRENCH_X[0] - 260 || enemies.some((e) => e.alive && e.target))) { battle = true; say("Düşmən bizi gördü! Donanma sahilə atəş açır — qırmızı halqadan qaç!", 4); }
    }
    allies.forEach((u, i) => u.update(dt, { foes: enemies, night: false, fog: 0, leader: pp, order, grid, mates: allies, onShot: shot, slot: i, blocked }));
    const foes: Target[] = [player, ...allies];
    for (const u of enemies) {
      if (!u.alive) continue;
      const busy = u.target || u.alert;
      if (u.dist > 300 && !busy) continue;
      u.acc += dt;
      if (u.dist > 120 && !busy && (frame + (u.hp | 0)) % 4) continue;
      u.update(u.acc, { foes, night: false, fog: 0, leader: pp, order, grid, mates: enemies, onShot: shot, slot: 0, blocked });
      u.acc = 0;
      if (u.target && u.fort.startsWith("t")) { // səngərdə vuruşma başladı — yaxın kazarma köməyə gəlir
        const bi = ENEMY_BARRACKS.reduce((b, q, j) => (Math.abs(q.x - u.pos.x) < Math.abs(ENEMY_BARRACKS[b].x - u.pos.x) ? j : b), 0);
        for (const m of enemies) if (m.alive && m.fort === "b" + bi && !m.target && !m.alert) { m.alert = u.pos.add(new Vector3(6 + Math.random() * 8, 0, (Math.random() - 0.5) * 30)); break; }
      }
    }
    Unit.tickFalls(dt);
    // toplar: yanında əsgər (və ya oyunçu) varsa ən yaxın gəmiyə özü atır
    for (const g of guns) {
      if (g === manning) continue;
      const crew = crewOf(g).filter((a) => Vector3.Distance(a.pos, g.pos) < 10).length + (Vector3.Distance(pp, g.pos) < 9 ? 1 : 0);
      if (!crew || !battle) continue;
      if ((g.cool -= dt * Math.min(1.5, 0.6 + crew * 0.3)) > 0) continue;
      const tgt = ships.filter((s) => s.alive && Vector3.Distance(s.pos, g.pos) < g.range).sort((a, b) => Vector3.Distance(a.pos, g.pos) - Vector3.Distance(b.pos, g.pos))[0];
      if (!tgt) continue;
      const d = Vector3.Distance(tgt.pos, g.pos), miss = Math.random() > (g.big ? 0.62 : 0.4), T = 2.2 + d / (g.big ? 420 : 320);
      const aim = tgt.pos.add(new Vector3(0, 4, 0)).add(miss ? new Vector3((Math.random() - 0.5) * 70, -4, (Math.random() - 0.5) * 70) : Vector3.Zero());
      g.yaw = Math.atan2(aim.x - g.pos.x, aim.z - g.pos.z); g.elev = Math.min(0.7, Math.max(0.03, Math.atan2(G * T * T * 0.5, d))); g.apply();
      fire(g.muzzle, lob(g.muzzle, aim, T), 0, 6, false, g.big, null);
      g.cool = g.reload + Math.random() * 3;
    }
    // donanma: döyüş başlayandan sonra sahildəki əsgərlərə atəş (qırmızı halqa — xəbərdarlıq)
    for (const s of ships) {
      s.update(dt);
      if (!s.alive || !battle || (s.cool -= dt) > 0) continue;
      const near = foes.filter((f) => f.alive && Vector3.Distance(f.pos, s.pos) < 1500);
      if (!near.length) { s.cool = 5; continue; }
      const t = Math.random() < 0.3 && near.includes(player) ? player : near[Math.floor(Math.random() * near.length)];
      const aim = t.pos.add(new Vector3((Math.random() - 0.5) * 26, 0, (Math.random() - 0.5) * 26)); aim.y = heightAt(aim.x, aim.z);
      const from = s.pos.add(new Vector3(0, 7, 0)), d = Vector3.Distance(from, aim), T = 3.2 + d / 330;
      fire(from, lob(from, aim, T), 85, 8, true, true, aim);
      s.cool = 24 + Math.random() * 18;
    }
    updateShells(dt);
    for (const t of tracers) if ((t.t -= dt) <= 0) t.l.isVisible = false;
    msgT -= dt;
    const landLeft = enemies.filter((e) => e.alive).length, crewLeft = ships.reduce((a, s) => a + s.crew, 0), sunk = ships.filter((s) => !s.alive).length;
    if ((!landLeft && sunk === ships.length) || !player.alive) return finish(player.alive);
    if ((hudT -= dt) <= 0) {
      hudT = 0.1;
      const g = player.gun, mg = manning;
      hudRef.update({ hp: player.hp, maxHp: player.maxHp, weapon: mg ? (mg.big ? "Böyük sahil topu" : "Sahə topu") : g.w.name, ammo: mg ? (mg.cool > 0 ? 0 : 1) : g.ammo, mag: mg ? 1 : g.w.mag, reloading: mg ? mg.cool > 0 : g.reloading > 0,
        hour: sky.hour, weather: "sübh", enemiesLeft: landLeft + crewLeft, enemiesTotal: enemies.length + 450, allies: allies.filter((a) => a.alive).length,
        form: null, cooldowns: [], fps: engine.getFps(), msg: msgT > 0 ? msg : "", forts: { cleared: sunk, total: ships.length }, scope: mg ? 0 : player.scope });
    }
  });

  function finish(won: boolean) { ended = true; document.exitPointerLock(); endScreen(won, quit); }
  function quit() {
    removeEventListener("keydown", onKey); Unit.onDeath = null; Unit.falling = []; player.interact = null;
    canvas.removeEventListener("pointerdown", unlock); sfx.dispose();
    document.removeEventListener("pointerlockchange", lockChange); canvas.removeEventListener("click", clickLock);
    hudRef.destroy(); player.dispose(); hitMark.remove();
    engine.stopRenderLoop(); scene.dispose(); onExit();
  }
  if (location.search.includes("test")) setInterval(() => scene.render(), 60);
  else engine.runRenderLoop(() => scene.render());
  (window as unknown as { __game: unknown }).__game = { player, allies, enemies, ships, guns, state: () => ({ paused, ended, time: gameTime, manning: !!manning, battle }) };
  lockSafe();
}
