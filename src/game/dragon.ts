// Dörd başlı əjdaha (orijinal dizayn, ~14 m): yerdə dayanır, E ilə minilir, Space ilə havaya qalxır.
// Hər başın öz boynu var: başlar 25 m-ə girən düşmənləri ayrı-ayrı seçib alov püskürür.
// Animasiya proseduradır: boyun/quyruq zəncirləri, iki hissəli qanad, dörd ayaq (yeriş), çənə, nəfəs.
import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { heightAt, type Grid } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";
import type { Target } from "./units";

const SCALE = "#4a1216", SCALE2 = "#6e1a1c", BELLY = "#b08a3a", HORN = "#e8dcc0", MEMB = "#2c0a0e", CLAW = "#1c1412";
/** gövdə mərkəzinin yerdən hündürlüyü (ayaqlar dik dayananda) */
const STAND = 2.7;
export const BREATH_RANGE = 25;

function radialTex(scene: Scene, name: string, stops: [number, string][]) {
  const t = new DynamicTexture(name, 64, scene, false), c = t.getContext() as CanvasRenderingContext2D;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update();
  return t;
}
let texCache: { flame: DynamicTexture; smoke: DynamicTexture } | null = null;
function texes(scene: Scene) {
  if (!texCache || texCache.flame.getScene() !== scene) texCache = {
    flame: radialTex(scene, "flameTex", [[0, "rgba(255,250,225,1)"], [0.3, "rgba(255,170,60,0.9)"], [0.7, "rgba(200,50,5,0.35)"], [1, "rgba(80,10,0,0)"]]),
    smoke: radialTex(scene, "smokeTex", [[0, "rgba(60,55,50,0.55)"], [0.6, "rgba(40,38,36,0.25)"], [1, "rgba(30,30,30,0)"]]),
  };
  return texCache;
}

/** bir başın alovu: nüvə (parlaq), tüstü, qığılcımlar + ağızda istilik parıltısı */
class Breath {
  core: ParticleSystem; smoke: ParticleSystem; sparks: ParticleSystem; glow: Mesh; private on = 0;
  constructor(scene: Scene, q: number) {
    const tx = texes(scene);
    const core = (this.core = new ParticleSystem("breathCore", Math.round(520 * q), scene));
    core.particleTexture = tx.flame; core.emitter = Vector3.Zero(); core.blendMode = ParticleSystem.BLENDMODE_ADD;
    core.minLifeTime = 0.32; core.maxLifeTime = 0.6; core.minEmitPower = 24; core.maxEmitPower = 34; core.updateSpeed = 0.016;
    core.addSizeGradient(0, 0.35, 0.6); core.addSizeGradient(0.35, 1.4, 2.1); core.addSizeGradient(1, 3.2, 4.2);
    core.addColorGradient(0, new Color4(1, 1, 0.9, 1)); core.addColorGradient(0.2, new Color4(1, 0.85, 0.35, 1));
    core.addColorGradient(0.55, new Color4(1, 0.38, 0.06, 0.85)); core.addColorGradient(1, new Color4(0.25, 0.04, 0.01, 0));
    core.addVelocityGradient(0, 1); core.addVelocityGradient(1, 0.35); // sonda yavaşlayıb yayılır
    core.minAngularSpeed = -3; core.maxAngularSpeed = 3; core.minInitialRotation = 0; core.maxInitialRotation = Math.PI * 2;
    core.gravity = new Vector3(0, 4, 0); core.emitRate = 0; core.start();
    const sm = (this.smoke = new ParticleSystem("breathSmoke", Math.round(160 * q), scene));
    sm.particleTexture = tx.smoke; sm.emitter = Vector3.Zero(); sm.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    sm.minLifeTime = 0.9; sm.maxLifeTime = 1.7; sm.minEmitPower = 9; sm.maxEmitPower = 14;
    sm.addSizeGradient(0, 1.2, 1.8); sm.addSizeGradient(1, 4.5, 6);
    sm.addColorGradient(0, new Color4(0.25, 0.2, 0.16, 0)); sm.addColorGradient(0.25, new Color4(0.22, 0.2, 0.18, 0.45)); sm.addColorGradient(1, new Color4(0.3, 0.3, 0.3, 0));
    sm.addVelocityGradient(0, 1); sm.addVelocityGradient(1, 0.2); sm.gravity = new Vector3(0, 5, 0);
    sm.minAngularSpeed = -1; sm.maxAngularSpeed = 1; sm.emitRate = 0; sm.start();
    const sp = (this.sparks = new ParticleSystem("breathSparks", Math.round(220 * q), scene));
    sp.particleTexture = tx.flame; sp.emitter = Vector3.Zero(); sp.blendMode = ParticleSystem.BLENDMODE_ADD;
    sp.minLifeTime = 0.5; sp.maxLifeTime = 1.1; sp.minEmitPower = 16; sp.maxEmitPower = 30; sp.minSize = 0.07; sp.maxSize = 0.18;
    sp.color1 = new Color4(1, 0.9, 0.5, 1); sp.color2 = new Color4(1, 0.55, 0.15, 1); sp.colorDead = new Color4(0.5, 0.1, 0, 0);
    sp.gravity = new Vector3(0, -9, 0); sp.emitRate = 0; sp.start();
    const gm = new StandardMaterial("breathGlow", scene);
    gm.emissiveColor = new Color3(1, 0.55, 0.15); gm.disableLighting = true; gm.alpha = 0.55; gm.alphaMode = 1; // ADD
    gm.opacityTexture = tx.flame;
    this.glow = MeshBuilder.CreatePlane("breathGlowP", { size: 2.4 }, scene);
    this.glow.material = gm; this.glow.billboardMode = Mesh.BILLBOARDMODE_ALL; this.glow.isPickable = false; this.glow.setEnabled(false);
  }
  /** amount 0..1 — alovun gücü (yavaş açılıb-bağlanır) */
  update(dt: number, amount: number, from: Vector3, dir: Vector3, q: number) {
    this.on += (amount - this.on) * Math.min(1, dt * 8);
    const k = this.on < 0.03 ? 0 : this.on, flick = 0.85 + Math.random() * 0.3;
    for (const p of [this.core, this.smoke, this.sparks]) (p.emitter as Vector3).copyFrom(from);
    this.core.emitRate = 260 * q * k * flick; this.smoke.emitRate = 55 * q * k; this.sparks.emitRate = 70 * q * k;
    const s = 0.1, d = dir;
    this.core.direction1.set(d.x - s, d.y - s, d.z - s); this.core.direction2.set(d.x + s, d.y + s, d.z + s);
    this.smoke.direction1.set(d.x - 0.25, d.y, d.z - 0.25); this.smoke.direction2.set(d.x + 0.25, d.y + 0.3, d.z + 0.25);
    this.sparks.direction1.set(d.x - 0.35, d.y - 0.1, d.z - 0.35); this.sparks.direction2.set(d.x + 0.35, d.y + 0.45, d.z + 0.35);
    this.glow.setEnabled(k > 0);
    if (k > 0) { this.glow.position.copyFrom(from); this.glow.scaling.setAll((0.7 + k * 0.6) * flick); }
  }
  dispose() { for (const p of [this.core, this.smoke, this.sparks]) p.dispose(); this.glow.dispose(); }
}

/** yerdə yanan od / yanan əsgər (hovuz) */
class Blaze {
  ps: ParticleSystem; t = 0; follow: Target | null = null;
  constructor(scene: Scene, q: number) {
    const p = (this.ps = new ParticleSystem("blaze", Math.round(90 * q), scene));
    p.particleTexture = texes(scene).flame; p.emitter = Vector3.Zero(); p.blendMode = ParticleSystem.BLENDMODE_ADD;
    p.minEmitBox = new Vector3(-0.5, 0, -0.5); p.maxEmitBox = new Vector3(0.5, 0.8, 0.5);
    p.minLifeTime = 0.3; p.maxLifeTime = 0.7; p.minEmitPower = 0.5; p.maxEmitPower = 1.5;
    p.direction1 = new Vector3(-0.2, 1, -0.2); p.direction2 = new Vector3(0.2, 1, 0.2); p.gravity = new Vector3(0, 3, 0);
    p.addSizeGradient(0, 0.5, 0.8); p.addSizeGradient(1, 0.1, 0.2);
    p.addColorGradient(0, new Color4(1, 0.8, 0.3, 1)); p.addColorGradient(1, new Color4(0.6, 0.1, 0, 0));
    p.emitRate = 0; p.start();
  }
}

interface Head { root: TransformNode; segs: TransformNode[]; head: TransformNode; jaw: TransformNode; mouth: TransformNode; fx: Breath; rest: number; target: Target | null; aim: Vector3 | null; fire: number; patchT: number }
interface Leg { hip: TransformNode; knee: TransformNode; ph: number; front: boolean }

export type RideInput = { fw: number; st: number; up: number; boost: boolean; yaw: number; pitch: number; fire: boolean };
type Burnable = Target & { hit(dmg: number, from?: Vector3, kind?: string): void; type?: { civ?: boolean } };

export class Dragon implements Target {
  ally = true; maxHp = 2000; hp = 2000; pos: Vector3; yaw = 0; rider = false;
  summon: Vector3 | null = null; summonOnly = false;
  /** "ground" — ayaq üstə, "air" — uçur */
  mode: "ground" | "air" = "ground";
  private root: TransformNode; private body: TransformNode;
  private heads: Head[] = []; private wings: { sh: TransformNode; el: TransformNode; s: number }[] = []; private legs: Leg[] = []; private tail: TransformNode[] = [];
  private t = Math.random() * 10; private flap = 0; private walk = 0; private gait = 0; private vy = 0; private takeoff = 0; private calm = 0; private down = false;
  private retarget = 0; private blazes: Blaze[] = []; private bank = 0; private pitchA = 0;
  /** alov səsi üçün: bu kadr hansısa baş alov püskürürmü */
  breathing = false;

  constructor(private scene: Scene, x: number, z: number, private q = 1) {
    this.pos = new Vector3(x, heightAt(x, z) + STAND, z);
    this.root = new TransformNode("dragon", scene);
    this.body = new TransformNode("dragonBody", scene); this.body.parent = this.root;
    const mat = vcMat(scene, "vcDragon", 0.4), eyeMat = glowMat(scene, "#ffd23a", "dragonEye");
    const node = (name: string, parent: TransformNode, p: [number, number, number]) => { const n = new TransformNode(name, scene); n.parent = parent; n.position.set(...p); return n; };
    const attach = (k: Kit, name: string, parent: TransformNode, m = mat) => { const mesh = k.build(name, m); mesh.parent = parent; mesh.isPickable = false; return mesh; };

    // gövdə: döş, qarın lövhələri, bel tikanları, çiyin qabarı (boyunlar buradan çıxır)
    { const k = new Kit(scene);
      k.sph(3.0, SCALE, [0, 0, -0.2], [0.92, 0.78, 1.55], 12).sph(2.9, SCALE2, [0, 0.15, 1.5], [1.05, 0.9, 0.9], 12)
        .sph(2.6, BELLY, [0, -0.45, 0.2], [0.75, 0.48, 1.45], 10);
      for (let i = 0; i < 6; i++) k.box(1.5 - i * 0.12, 0.08, 0.5, BELLY, [0, -1.08 + i * 0.02, 1.6 - i * 0.62], [0.06, 0, 0]);
      for (let i = 0; i < 7; i++) k.cyl(0.6 - i * 0.04, 0, 0.32, HORN, [0, 1.15 - i * 0.04, 1.4 - i * 0.62], [-0.35, 0, 0], 4);
      k.sph(1.9, SCALE2, [0, 0.75, 2.4], [1.5, 0.7, 0.8], 10); // çiyin qabarı
      attach(k, "dragonTorso", this.body); }

    // 4 boyun + baş: çiyin boyunca yelpik kimi açılır
    const roots: [number, number][] = [[-1.05, -0.6], [-0.36, -0.2], [0.36, 0.2], [1.05, 0.6]];
    roots.forEach(([x, rest], hi) => {
      const root = node("neck" + hi, this.body, [x, 0.95, 2.7]); root.rotation.set(-0.75, rest, 0);
      const segs: TransformNode[] = []; let parent = root;
      for (let i = 0; i < 4; i++) {
        const s = i ? node(`neck${hi}_${i}`, parent, [0, 0, 0.82]) : root;
        const k = new Kit(scene), w = 0.82 - i * 0.08;
        k.sph(1, i % 2 ? SCALE2 : SCALE, [0, 0, 0.42], [w, w, 1.15], 8).sph(0.55, BELLY, [0, -w * 0.32, 0.42], [w * 0.9, 0.5, 1.05], 6)
          .cyl(0.32, 0, 0.18, HORN, [0, w * 0.48, 0.4], [-0.5, 0, 0], 4);
        attach(k, "neckSeg", s); segs.push(s); parent = s;
        if (i) s.rotation.x = 0.16;
      }
      const head = node("head" + hi, parent, [0, 0, 0.85]); head.rotation.x = 0.55;
      { const k = new Kit(scene);
        k.sph(0.95, SCALE, [0, 0.1, 0.05], [0.95, 0.8, 1.05], 10).box(0.62, 0.36, 0.95, SCALE2, [0, 0.02, 0.72])
          .box(0.5, 0.1, 0.8, BELLY, [0, -0.15, 0.72]) // üst damaq
          .cyl(0.75, 0.02, 0.17, HORN, [0.26, 0.48, -0.15], [-1.25, 0, 0.3], 6).cyl(0.75, 0.02, 0.17, HORN, [-0.26, 0.48, -0.15], [-1.25, 0, -0.3], 6)
          .cyl(0.35, 0.02, 0.1, HORN, [0.18, 0.2, 1.05], [-0.4, 0, 0], 4).cyl(0.35, 0.02, 0.1, HORN, [-0.18, 0.2, 1.05], [-0.4, 0, 0], 4) // burun buynuzları
          .sph(0.42, SCALE2, [0.42, 0.05, 0.05], [0.4, 0.9, 1.3], 6).sph(0.42, SCALE2, [-0.42, 0.05, 0.05], [0.4, 0.9, 1.3], 6); // yanaq qanadları
        for (let t = 0; t < 4; t++) k.cyl(0.14, 0, 0.05, HORN, [t % 2 ? 0.2 : -0.2, -0.22, 0.45 + Math.floor(t / 2) * 0.35], [Math.PI, 0, 0], 3); // dişlər
        attach(k, "dragonHead", head); }
      { const k = new Kit(scene); k.box(0.07, 0.07, 0.04, "#ffd23a", [0.24, 0.2, 0.48]).box(0.07, 0.07, 0.04, "#ffd23a", [-0.24, 0.2, 0.48]); attach(k, "dragonEyes", head, eyeMat); }
      const jaw = node("jaw" + hi, head, [0, -0.2, 0.25]);
      { const k = new Kit(scene); k.box(0.5, 0.16, 0.9, SCALE, [0, -0.08, 0.42]).box(0.42, 0.06, 0.8, "#7a2a22", [0, 0.01, 0.42]);
        for (let t = 0; t < 4; t++) k.cyl(0.12, 0, 0.05, HORN, [t % 2 ? 0.17 : -0.17, 0.08, 0.3 + Math.floor(t / 2) * 0.35], undefined, 3);
        attach(k, "dragonJaw", jaw); }
      const mouth = node("mouth" + hi, head, [0, -0.12, 1.3]);
      this.heads.push({ root, segs, head, jaw, mouth, fx: new Breath(scene, q), rest, target: null, aim: null, fire: 0, patchT: 0 });
    });

    // quyruq: 9 həlqə, tikanlar, ucunda ox
    { let parent = node("tail0", this.body, [0, 0.1, -2.6]); parent.rotation.x = -0.15;
      for (let i = 0; i < 9; i++) {
        const s = i ? node("tail" + i, parent, [0, 0, -0.8]) : parent, w = 1.0 - i * 0.09;
        const k = new Kit(scene); k.sph(1, i % 2 ? SCALE2 : SCALE, [0, 0, -0.4], [w, w * 0.85, 1.1], 8).cyl(0.35 * w + 0.1, 0, 0.22 * w + 0.06, HORN, [0, w * 0.45, -0.4], [-0.6, 0, 0], 4);
        if (i === 8) k.cyl(0.9, 0, 0.7, HORN, [0, 0, -1.0], [-Math.PI / 2, 0, 0], 4, [1, 1, 0.25]);
        attach(k, "tailSeg", s); this.tail.push(s); parent = s;
      } }

    // qanadlar: çiyin (daxili) + dirsək (xarici) — pərdəli
    for (const s of [-1, 1]) {
      const sh = node("wingSh", this.body, [s * 1.1, 1.0, 1.0]), el = node("wingEl", sh, [s * 3.2, 0, 0]);
      { const k = new Kit(scene);
        k.cyl(3.3, 0.18, 0.32, SCALE, [s * 1.6, 0, 0], [0, 0, Math.PI / 2], 6).box(3.1, 0.05, 2.9, MEMB, [s * 1.65, -0.04, -1.35])
          .cyl(2.9, 0.05, 0.1, SCALE, [s * 2.6, 0, -1.4], [Math.PI / 2, 0, 0], 4);
        attach(k, "wingIn", sh); }
      { const k = new Kit(scene);
        k.cyl(3.4, 0.08, 0.2, SCALE, [s * 1.7, 0, 0], [0, 0, Math.PI / 2], 6).cyl(0.5, 0, 0.12, HORN, [s * 3.5, 0, 0.05], [0, 0, -s * Math.PI / 2], 4) // pəncə
          .box(3.3, 0.05, 2.6, MEMB, [s * 1.6, -0.04, -1.25]).box(1.6, 0.05, 1.5, MEMB, [s * 3.0, -0.04, -0.9]);
        for (const fz of [-1.2, -2.3]) k.cyl(2.6, 0.03, 0.08, SCALE, [s * 1.9, 0, fz], [Math.PI / 2, s * 0.5, 0], 4); // barmaqlar
        attach(k, "wingOut", el); }
      this.wings.push({ sh, el, s });
    }

    // ayaqlar: bud + baldır + pəncə
    const legAt: [number, number, number, boolean, number][] = [[1.15, -0.75, 1.5, true, 0], [-1.15, -0.75, 1.5, true, Math.PI], [1.2, -0.7, -1.4, false, Math.PI], [-1.2, -0.7, -1.4, false, 0]];
    for (const [x, y, z, front, ph] of legAt) {
      const hip = node("hip", this.body, [x, y, z]), knee = node("knee", hip, [0, -1.15, front ? 0.15 : -0.2]);
      { const k = new Kit(scene); k.cyl(1.35, 0.42, 0.7, SCALE, [0, -0.5, 0.05], [front ? 0.12 : -0.15, 0, 0], 8); attach(k, "thigh", hip); }
      { const k = new Kit(scene); k.cyl(1.1, 0.42, 0.3, SCALE2, [0, -0.55, 0], undefined, 8).box(0.55, 0.22, 0.7, SCALE, [0, -1.1, 0.15]);
        for (const cx of [-0.18, 0, 0.18]) k.cyl(0.3, 0, 0.09, CLAW, [cx, -1.15, 0.55], [Math.PI / 2, 0, 0], 4);
        attach(k, "shin", knee); }
      this.legs.push({ hip, knee, ph, front });
    }
    for (let i = 0; i < 8; i++) this.blazes.push(new Blaze(scene, q));
    this.place();
  }

  get alive() { return this.hp > 0 && !this.down; }
  hit(d: number) { this.hp = Math.max(0, this.hp - d * 0.4); this.calm = 0; }
  /** yəhər: çiyinlərlə qanadlar arasında */
  get saddle() { return this.pos.add(new Vector3(0, 1.45, 0)).add(this.forward.scale(0.5)); }
  get forward() { return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  /** yerdən hündürlük */
  get altitude() { return this.pos.y - heightAt(this.pos.x, this.pos.z) - STAND; }
  get grounded() { return this.mode === "ground"; }

  private place() { this.root.position.copyFrom(this.pos); this.root.rotation.y = this.yaw; }
  private ground() { return heightAt(this.pos.x, this.pos.z) + STAND; }

  /** başlar üçün hədəf seçimi: 25 m-dəki düşmənlər, hər baş mümkünsə ayrı hədəf */
  private pickTargets(foes: Target[], manual: Vector3 | null) {
    if (manual) { for (const h of this.heads) { h.target = null; h.aim = manual; } return; }
    const near = (foes as Burnable[]).filter((t) => t.alive && !t.ally && !t.type?.civ && Vector3.Distance(t.pos, this.pos) < BREATH_RANGE + 2)
      .sort((a, b) => Vector3.DistanceSquared(a.pos, this.pos) - Vector3.DistanceSquared(b.pos, this.pos));
    const used = new Set<Target>();
    for (const h of this.heads) {
      h.aim = null;
      if (h.target?.alive && near.includes(h.target as Burnable) && this.reach(h, h.target.pos)) { used.add(h.target); continue; }
      h.target = near.find((t) => !used.has(t) && this.reach(h, t.pos)) ?? near.find((t) => this.reach(h, t.pos)) ?? null;
      if (h.target) used.add(h.target);
    }
  }
  /** başın dönə biləcəyi bucaq (gövdəyə görə ±100°) */
  private reach(h: Head, p: Vector3) {
    const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z) - this.yaw, d = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(d - h.rest * 0.5) < 1.75;
  }
  private pickTargetsTimed(dt: number, foes: Target[], manual: Vector3 | null) {
    if (manual) { this.pickTargets(foes, manual); return; }
    if ((this.retarget -= dt) <= 0) { this.retarget = 0.3; this.pickTargets(foes, null); }
  }
  private land() { this.mode = "ground"; this.pos.y = this.ground(); this.vy = 0; this.gait = 0.5; }

  /** hər kadr: hərəkət, animasiya, alov, zərər */
  update(dt: number, leader: Vector3, foes: Target[], ride?: RideInput, grid?: Grid) {
    void leader;
    this.t += dt;
    if ((this.calm += dt) > 8 || this.down) this.hp = Math.min(this.maxHp, this.hp + 25 * dt);
    if (this.hp <= 0 && !this.down) { this.down = true; this.mode = "air"; }
    if (this.down && this.hp >= 400) this.down = false;
    let fw = 0; // yerdə irəli sürət (yeriş animasiyası üçün)

    if (this.down) { // yaralı: yerə düşür, uzanır
      this.pos.y = Math.max(this.ground() - 0.9, this.pos.y - 14 * dt);
      if (this.pos.y <= this.ground() - 0.85) this.mode = "ground";
    } else if (ride) {
      const turn = Math.atan2(Math.sin(ride.yaw - this.yaw), Math.cos(ride.yaw - this.yaw));
      if (this.mode === "ground") {
        this.yaw += Math.sign(turn) * Math.min(Math.abs(turn), dt * (ride.fw ? 2.2 : 1.4));
        const sp = (ride.boost ? 13 : 7) * ride.fw, f = this.forward;
        this.pos.addInPlace(f.scale(sp * dt)).addInPlace(new Vector3(f.z, 0, -f.x).scale(ride.st * 3.5 * dt));
        fw = ride.fw * (ride.boost ? 1.6 : 1) + Math.abs(ride.st) * 0.5;
        this.pos.y = this.ground();
        if (ride.up > 0) { this.mode = "air"; this.takeoff = 0.8; this.vy = 9; }
      } else {
        this.yaw = ride.yaw;
        const sp = (ride.boost ? 38 : 20) * dt, f = this.forward, right = new Vector3(f.z, 0, -f.x);
        this.pos.addInPlace(f.scale(ride.fw * sp)).addInPlace(right.scale(ride.st * sp * 0.6));
        this.vy += ((ride.up * 12 - ride.pitch * ride.fw * 14) - this.vy) * Math.min(1, dt * 4);
        if (this.takeoff > 0) { this.takeoff -= dt; this.vy = Math.max(this.vy, 7); }
        this.pos.y += this.vy * dt;
        this.bank += ((-turn * 2 - ride.st * 0.4) - this.bank) * Math.min(1, dt * 3);
        if (this.pos.y <= this.ground() + 0.05 && ride.up <= 0 && this.takeoff <= 0) this.land();
      }
      const aim = ride.fire ? this.pos.add(new Vector3(Math.sin(ride.yaw) * Math.cos(ride.pitch), -Math.sin(ride.pitch) - 0.25, Math.cos(ride.yaw) * Math.cos(ride.pitch)).scale(20)) : null;
      this.pickTargetsTimed(dt, foes, aim);
    } else if (this.summon) { // çağırılıb: oyunçunun yanına uçub yerə enir
      const goal = this.summon.add(new Vector3(4, 0, 4)), to = goal.subtract(this.pos); to.y = 0;
      const d = to.length();
      if (d > 14) { this.mode = "air"; const cruise = this.ground() + 14; this.pos.y += (cruise - this.pos.y) * Math.min(1, dt * 1.5); }
      if (d > 0.5) { this.pos.addInPlace(to.scale(Math.min(1, (dt * Math.min(30, d * 1.5)) / d))); this.yaw = Math.atan2(to.x, to.z); }
      if (d < 14) { this.pos.y = Math.max(this.ground(), this.pos.y - 9 * dt); if (this.pos.y <= this.ground() + 0.05) { this.land(); if (d < 1.5) this.summon = null; } }
      fw = this.mode === "ground" && d > 0.5 ? 1 : 0;
      this.pickTargetsTimed(dt, foes, null);
    } else { // minilməyib: yerdə dayanır, yaxına gələni yandırır
      if (this.mode === "air") { this.pos.y = Math.max(this.ground(), this.pos.y - 8 * dt); if (this.pos.y <= this.ground() + 0.05) this.land(); }
      else this.pos.y = this.ground();
      this.pickTargetsTimed(dt, foes, null);
      const tg = this.heads.find((h) => h.target)?.target; // hədəf arxadadırsa yavaşca dönür
      if (tg) { const a = Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z) - this.yaw, d = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(d) > 0.6) this.yaw += Math.sign(d) * dt * 0.9; }
    }
    if (grid && this.mode === "ground") for (const o of grid.near(this.pos.x, this.pos.z)) { // binalardan keçməsin
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz), r = o.r + 2.4;
      if (d < r && d > 1e-4) { this.pos.x = o.x + (dx / d) * r; this.pos.z = o.z + (dz / d) * r; }
    }
    const floor = this.down ? this.ground() - 0.9 : this.mode === "ground" ? this.ground() : this.ground() - 0.9;
    this.pos.y = Math.min(Math.max(this.pos.y, floor), heightAt(this.pos.x, this.pos.z) + 120);
    if (this.mode === "ground") this.bank *= Math.max(0, 1 - dt * 4);
    this.place();
    this.animate(dt, fw);
    this.breathe(dt, foes);
  }

  /** prosedur animasiya */
  private animate(dt: number, fw: number) {
    const t = this.t, air = this.mode === "air" && !this.down, down = this.down;
    const moving = Math.abs(fw) > 0.05 ? 1 : 0;
    this.walk += dt * (2.2 + Math.abs(fw) * 3.2) * moving;
    this.gait += (moving - this.gait) * Math.min(1, dt * 5);
    // qanad çırpma: qalxanda güclü və sürətli, düz uçuşda ritmik, yerdə qatlanmış
    this.flap += dt * (this.takeoff > 0 ? 9 : air ? (this.vy > 2 ? 7.5 : 5) : 0);
    const k = Math.min(1, dt * 6), lerp = (a: number, b: number) => a + (b - a) * k;
    for (const w of this.wings) {
      const s = w.s, ph = this.flap;
      const shZ = air ? s * (0.15 + 0.85 * Math.sin(ph)) : down ? s * -0.35 : s * 1.05;
      const shY = air ? s * (0.05 + 0.1 * Math.cos(ph)) : down ? 0 : s * 0.95;
      const elZ = air ? s * (0.45 * Math.sin(ph - 1.1) - 0.05) : down ? s * -0.2 : s * -2.3;
      const elY = air || down ? 0 : s * 0.75;
      w.sh.rotation.z = lerp(w.sh.rotation.z, shZ); w.sh.rotation.y = lerp(w.sh.rotation.y, shY);
      w.el.rotation.z = lerp(w.el.rotation.z, elZ); w.el.rotation.y = lerp(w.el.rotation.y, elY);
    }
    // gövdə: nəfəs, yerişdə yırğalanma, uçuşda qanad ritmi ilə qalxıb-enmə, dönüşdə əyilmə
    const breath = Math.sin(t * 1.6) * 0.025;
    this.body.scaling.set(1 + breath * 0.5, 1 + breath, 1);
    this.pitchA = lerp(this.pitchA, air ? Math.max(-0.45, Math.min(0.35, -this.vy * 0.04)) : down ? 0.12 : -0.03);
    this.body.rotation.x = this.pitchA;
    this.body.rotation.z = air ? this.bank * 0.35 : Math.sin(this.walk) * 0.05 * this.gait;
    this.body.position.y = air ? -Math.sin(this.flap) * 0.35 : down ? 0 : Math.abs(Math.sin(this.walk)) * 0.18 * this.gait - 0.05 * this.gait;
    // ayaqlar: diaqonal cütlərlə yeriş; uçuşda arxaya yığılır; yaralıda yanlara açılır
    for (const l of this.legs) {
      const s = Math.sin(this.walk + l.ph) * this.gait, lift = Math.max(0, -Math.cos(this.walk + l.ph)) * this.gait;
      l.hip.rotation.x = lerp(l.hip.rotation.x, air ? (l.front ? 0.9 : 1.1) : down ? -0.6 : s * 0.55);
      l.knee.rotation.x = lerp(l.knee.rotation.x, air ? (l.front ? -1.2 : -0.9) : down ? 1.0 : (l.front ? -1 : 1) * lift * 0.7);
    }
    // quyruq: dalğa kimi yellənmə (uçuşda uzanır)
    this.tail.forEach((s, i) => {
      s.rotation.y = Math.sin(t * (air ? 2.4 : 1.3) - i * 0.55) * (air ? 0.07 : 0.12) * (1 + i * 0.08) + (air ? this.bank * 0.05 : 0);
      s.rotation.x = lerp(s.rotation.x, i === 0 ? (air ? 0.05 : -0.3) : air ? -0.02 + Math.sin(this.flap - i * 0.6) * 0.03 : 0.07);
    });
    // boyunlar: hədəfə dönür (yaw kökdə, pitch başda), yoxsa yavaş yellənir; yaralıda yerə sallanır
    this.heads.forEach((h, i) => {
      let yaw = h.rest + Math.sin(t * 0.7 + i * 1.7) * 0.18, rootX = -0.75 + Math.sin(t * 0.9 + i) * 0.08, headX = 0.55;
      const goal = h.aim ?? h.target?.pos.add(new Vector3(0, 1.0, 0)) ?? null;
      if (goal && !down) {
        const base = h.root.getAbsolutePosition(), v = goal.subtract(base), a = Math.atan2(v.x, v.z) - this.yaw;
        yaw = Math.max(-1.6, Math.min(1.6, Math.atan2(Math.sin(a), Math.cos(a))));
        const elev = Math.atan2(v.y, Math.hypot(v.x, v.z));
        rootX = air ? -0.25 : -0.55; headX = Math.max(-0.4, Math.min(1.6, -elev - rootX - 0.16 * 3 - this.pitchA));
      }
      if (down) { rootX = 0.55; headX = 0.4; yaw = h.rest * 1.4; }
      if (air && !goal) { rootX = -0.35; headX = 0.3; }
      h.root.rotation.y = lerp(h.root.rotation.y, yaw); h.root.rotation.x = lerp(h.root.rotation.x, rootX);
      h.head.rotation.x = lerp(h.head.rotation.x, headX + (h.fire > 0.1 ? -0.12 : 0)); // alovda baş azca geri atılır
      h.segs.forEach((s, j) => { if (j) s.rotation.y = Math.sin(t * 1.1 + i + j * 0.6) * 0.05; });
      h.jaw.rotation.x = lerp(h.jaw.rotation.x, h.fire > 0.1 ? 0.55 + Math.sin(t * 30) * 0.05 : Math.max(0, Math.sin(t * 0.8 + i * 2)) * 0.08);
    });
  }

  /** alov: başın baxdığı istiqamətdə 25 m konus; zərər, yanan torpaq/əsgər */
  private breathe(dt: number, foes: Target[]) {
    this.root.computeWorldMatrix(true); this.body.computeWorldMatrix(true);
    this.breathing = false;
    for (const h of this.heads) {
      for (const n of [...h.segs, h.head, h.mouth]) n.computeWorldMatrix(true);
      const from = h.mouth.getAbsolutePosition().clone(), dir = h.head.getDirection(Vector3.Forward()).normalize();
      const goal = h.aim ?? h.target?.pos.add(new Vector3(0, 1.0, 0)) ?? null;
      const want = !this.down && goal && Vector3.Distance(goal, from) < BREATH_RANGE + 3 && Vector3.Dot(goal.subtract(from).normalize(), dir) > 0.75 ? 1 : 0;
      h.fire += (want - h.fire) * Math.min(1, dt * 6);
      h.fx.update(dt, want, from, dir, this.q);
      if (h.fire < 0.3) continue;
      this.breathing = true;
      for (const t of foes as Burnable[]) {
        if (!t.alive || t.ally || t.type?.civ) continue;
        const v = t.pos.add(new Vector3(0, 1, 0)).subtract(from), d = v.length();
        if (d < BREATH_RANGE && Vector3.Dot(v.scale(1 / d), dir) > 0.86) {
          t.hit(130 * dt * h.fire, from, "fire");
          if (Math.random() < dt * 3) this.ignite(t.pos, t);
        }
      }
      if ((h.patchT -= dt) <= 0) { // alov yerə dəydiyi nöqtədə od
        h.patchT = 0.35;
        for (let s = 2; s < BREATH_RANGE; s += 1.5) { const p = from.add(dir.scale(s)); if (p.y <= heightAt(p.x, p.z) + 0.2) { this.ignite(p, null); break; } }
      }
    }
    for (const b of this.blazes) {
      if (b.t <= 0) { b.ps.emitRate = 0; continue; }
      b.t -= dt;
      if (b.follow) (b.ps.emitter as Vector3).copyFrom(b.follow.pos);
      b.ps.emitRate = 70 * this.q * Math.min(1, b.t);
    }
  }
  private ignite(p: Vector3, follow: Target | null) {
    const b = this.blazes.find((x) => x.t <= 0) ?? this.blazes.reduce((a, c) => (a.t < c.t ? a : c));
    b.t = follow ? 2.6 : 3.2; b.follow = follow; (b.ps.emitter as Vector3).copyFrom(p);
  }
  dispose() { for (const h of this.heads) h.fx.dispose(); for (const b of this.blazes) b.ps.dispose(); this.root.dispose(); }
}
