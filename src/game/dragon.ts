// Əjdaha (orijinal dizayn, ~7 m): dəstədə uçur, düşmənə alov püskürür; G ilə minib idarə etmək olar.
import { Color4, Mesh, ParticleSystem, Scene, TransformNode, Vector3, DynamicTexture } from "@babylonjs/core";
import { heightAt } from "./logic";
import { Kit, vcMat } from "./kit";
import type { Target } from "./units";

const SCALE = "#5a1418", BELLY = "#b08a3a", HORN = "#e8dcc0", MEMB = "#3a0c10";

function flameTex(scene: Scene) {
  const t = new DynamicTexture("flame", 64, scene, false), c = t.getContext() as CanvasRenderingContext2D;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,240,200,1)"); g.addColorStop(0.35, "rgba(255,150,40,0.9)"); g.addColorStop(1, "rgba(120,20,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.hasAlpha = true; t.update();
  return t;
}

export class Dragon implements Target {
  ally = true; hp = 1500; pos: Vector3; yaw = 0; rider = false; private root: TransformNode;
  private wings: Mesh[] = []; private flap = 0; private fire: ParticleSystem; private breathT = 0; private cool = 0; private orbit = 0;
  vy = 0; private target: Target | null = null;

  constructor(private scene: Scene, x: number, z: number) {
    this.pos = new Vector3(x, heightAt(x, z) + 1.8, z);
    this.root = new TransformNode("dragon", scene);
    const k = new Kit(scene), mat = vcMat(scene, "vcDragon", 0.35);
    // gövdə, qarın, boyun, baş (çənə, buynuzlar, gözlər), quyruq, ayaqlar
    k.sph(2.6, SCALE, [0, 0, 0], [0.85, 0.75, 1.5], 10).sph(2.3, BELLY, [0, -0.35, 0.1], [0.7, 0.5, 1.35], 8);
    for (let i = 0; i < 4; i++) k.sph(1.1 - i * 0.12, SCALE, [0, 0.45 + i * 0.35, 1.9 + i * 0.55], [1, 1, 1.3], 8);
    k.box(0.8, 0.6, 1.3, SCALE, [0, 1.9, 4.4]).box(0.7, 0.22, 1.1, BELLY, [0, 1.55, 4.45], [0.15, 0, 0])
      .cyl(0.9, 0.02, 0.18, HORN, [0.3, 2.35, 3.9], [-1.1, 0, 0.2], 6).cyl(0.9, 0.02, 0.18, HORN, [-0.3, 2.35, 3.9], [-1.1, 0, -0.2], 6)
      .box(0.14, 0.08, 0.06, "#ffd84a", [0.3, 2.05, 4.75]).box(0.14, 0.08, 0.06, "#ffd84a", [-0.3, 2.05, 4.75]);
    for (let i = 0; i < 7; i++) k.sph(1.0 - i * 0.12, SCALE, [0, 0.1 - i * 0.08, -1.9 - i * 0.55], [1, 0.9, 1.4], 8);
    k.cyl(0.8, 0, 0.5, SCALE, [0, -0.5, -5.9], [-Math.PI / 2, 0, 0], 4);
    for (let i = 0; i < 6; i++) k.cyl(0.45, 0, 0.3, HORN, [0, 1.0 - i * 0.05, 1.4 - i * 1.1], [-0.3, 0, 0], 4); // bel tikanları
    for (const [x, z] of [[0.7, 0.9], [-0.7, 0.9], [0.7, -0.9], [-0.7, -0.9]]) k.cyl(1.3, 0.35, 0.25, SCALE, [x, -1.1, z], [0.2, 0, 0], 6).box(0.4, 0.15, 0.5, HORN, [x, -1.75, z + 0.25]);
    k.build("dragonBody", mat).parent = this.root;
    for (const s of [-1, 1]) { // qanadlar: çiyindən yellənir
      const w = new Kit(scene);
      w.box(3.6, 0.15, 0.25, SCALE, [s * 1.8, 0, 0]).box(3.2, 0.05, 2.6, MEMB, [s * 2.0, -0.05, -1.25]).box(1.6, 0.05, 1.6, MEMB, [s * 3.3, -0.05, -0.9]);
      const wm = w.build("wing", mat);
      const pivot = new TransformNode("wingPivot", scene); pivot.parent = this.root; pivot.position.set(s * 0.8, 0.8, 0.6);
      wm.parent = pivot; this.wings.push(wm);
    }
    for (const m of this.root.getChildMeshes()) { m.isPickable = false; }
    // alov
    const f = new ParticleSystem("breath", 900, scene);
    f.particleTexture = flameTex(scene); f.emitter = Vector3.Zero();
    f.minSize = 0.6; f.maxSize = 2.2; f.minLifeTime = 0.25; f.maxLifeTime = 0.55; f.emitRate = 0;
    f.color1 = new Color4(1, 0.8, 0.3, 1); f.color2 = new Color4(1, 0.35, 0.05, 1); f.colorDead = new Color4(0.2, 0.05, 0, 0);
    f.minEmitPower = 22; f.maxEmitPower = 30; f.blendMode = ParticleSystem.BLENDMODE_ADD; f.updateSpeed = 0.02;
    f.start(); this.fire = f;
  }
  get alive() { return this.hp > 0; }
  hit(d: number) { this.hp = Math.max(0, this.hp - d * 0.5); }
  get saddle() { return this.pos.add(new Vector3(0, 1.4, 0.4)); }
  get forward() { return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /** alov püskür: ağız qarşısında 18 m konusda zərər */
  breathe(dir: Vector3, foes: Target[], dt: number) {
    this.breathT = 0.15;
    const mouth = this.pos.add(this.forward.scale(4.8)).add(new Vector3(0, 1.8, 0)), d = dir.normalize();
    (this.fire.emitter as Vector3).copyFrom(mouth);
    this.fire.direction1 = d.add(new Vector3(-0.12, -0.08, -0.12)); this.fire.direction2 = d.add(new Vector3(0.12, 0.08, 0.12));
    for (const t of foes) {
      if (!t.alive || t.ally) continue;
      const v = t.pos.subtract(mouth), dist = v.length();
      if (dist < 18 && Vector3.Dot(v.normalize(), d) > 0.8) t.hit(140 * dt);
    }
  }

  /** minilməyəndə: oyunçunun üstündə dövrə vurur, yaxın düşmənə enib alov püskürür */
  update(dt: number, leader: Vector3, foes: Target[], ride?: { fw: number; st: number; up: number; boost: boolean; yaw: number; pitch: number; fire: boolean }) {
    this.flap += dt * (ride || this.pos.y - heightAt(this.pos.x, this.pos.z) > 3 ? 7 : 2);
    this.wings.forEach((w, i) => ((w.parent as TransformNode).rotation.z = (i ? -1 : 1) * Math.sin(this.flap) * 0.6));
    if ((this.breathT -= dt) <= 0) this.fire.emitRate = 0; else this.fire.emitRate = 700;
    if (ride) {
      this.yaw = ride.yaw;
      const sp = (ride.boost ? 38 : 20) * dt, fwd = this.forward, right = new Vector3(fwd.z, 0, -fwd.x);
      this.pos.addInPlace(fwd.scale(ride.fw * sp)).addInPlace(right.scale(ride.st * sp * 0.6));
      this.pos.y += (ride.up * 12 - ride.pitch * ride.fw * 14) * dt;
      if (ride.fire) this.breathe(new Vector3(fwd.x, -0.35 - ride.pitch * 0.8, fwd.z), foes, dt);
    } else {
      this.cool -= dt;
      if (!this.target?.alive || this.cool < -6) { // yaxın düşmən axtar (oyunçunun 70 m-də)
        this.target = null; let bd = 70;
        for (const t of foes) { if (!t.alive || t.ally) continue; const d = Vector3.Distance(t.pos, leader); if (d < bd) { bd = d; this.target = t; } }
        this.cool = 0;
      }
      this.orbit += dt * 0.5;
      const goal = this.target ? this.target.pos.add(new Vector3(-Math.sin(this.orbit) * 14, 9, -Math.cos(this.orbit) * 14))
        : leader.add(new Vector3(Math.sin(this.orbit) * 18, 16, Math.cos(this.orbit) * 18));
      const to = goal.subtract(this.pos), d = to.length();
      if (d > 0.5) { this.pos.addInPlace(to.scale(Math.min(1, (dt * Math.min(30, d * 1.2)) / d))); this.yaw = Math.atan2(to.x, to.z); }
      if (this.target && Vector3.Distance(this.pos, this.target.pos) < 22) {
        this.yaw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
        this.breathe(this.target.pos.subtract(this.pos.add(this.forward.scale(4.8)).add(new Vector3(0, 1.8, 0))), foes, dt);
      }
    }
    this.pos.y = Math.max(this.pos.y, heightAt(this.pos.x, this.pos.z) + 1.8);
    this.pos.y = Math.min(this.pos.y, heightAt(this.pos.x, this.pos.z) + 120);
    this.root.position.copyFrom(this.pos); this.root.rotation.y = this.yaw;
  }
}
