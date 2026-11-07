// Motosiklet (orijinal low-poly model): E ilə min/düş, W qaz, S əyləc/geri, A/D sükan, Shift nitro.
// Sürərkən siçanla nişan alıb atəş açmaq olur (kamera motosikletdən asılı olmadan fırlanır).
import { Color4, DynamicTexture, Mesh, ParticleSystem, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { HALF, heightAt, type Grid } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";

const PAINT = "#a3161c", DARK = "#1a1a1d", CHROME = "#b9bec6", TYRE = "#0e0e10", SEAT = "#2a1a14";
const WHEEL_R = 0.36, BASE = 1.45; // təkər radiusu, təkərlər arası məsafə

function puffTex(scene: Scene) {
  const t = new DynamicTexture("puff", 32, scene, false), c = t.getContext() as CanvasRenderingContext2D, g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(200,200,200,0.8)"); g.addColorStop(1, "rgba(200,200,200,0)"); c.fillStyle = g; c.fillRect(0, 0, 32, 32); t.hasAlpha = true; t.update();
  return t;
}

export type MotoInput = { fw: number; st: number; boost: boolean };

export class Moto {
  pos: Vector3; yaw = 0; speed = 0; lean = 0; pitch = 0; rider = false;
  private root: TransformNode; private body: TransformNode; private fork: TransformNode; private front: Mesh; private rear: Mesh;
  private smoke: ParticleSystem; private spin = 0; private steer = 0; bump = 0;

  constructor(scene: Scene, x: number, z: number, yaw = 0) {
    this.pos = new Vector3(x, heightAt(x, z), z); this.yaw = yaw;
    this.root = new TransformNode("moto", scene);
    this.body = new TransformNode("motoBody", scene); this.body.parent = this.root;
    const mat = vcMat(scene, "vcMoto", 0.6);
    const wheel = (name: string) => {
      const k = new Kit(scene);
      k.cyl(0.2, WHEEL_R * 2, WHEEL_R * 2, TYRE, [0, 0, 0], [0, 0, Math.PI / 2], 16).cyl(0.22, WHEEL_R * 1.25, WHEEL_R * 1.25, CHROME, [0, 0, 0], [0, 0, Math.PI / 2], 12)
        .cyl(0.26, 0.14, 0.14, DARK, [0, 0, 0], [0, 0, Math.PI / 2], 8);
      for (let i = 0; i < 5; i++) k.box(0.04, WHEEL_R * 1.2, 0.05, DARK, [0, 0, 0], [(i * Math.PI) / 5, 0, 0]); // diskin pərləri
      const m = k.build(name, mat); m.isPickable = false; return m;
    };
    // gövdə: çərçivə, mühərrik, bak, oturacaq, egzoz, arxa qanad, stop işığı
    { const k = new Kit(scene);
      k.box(0.32, 0.36, 0.6, DARK, [0, 0.42, -0.05]).box(0.36, 0.22, 0.42, CHROME, [0, 0.35, 0.05]) // mühərrik
        .sph(0.62, PAINT, [0, 0.82, 0.22], [0.75, 0.55, 1.25], 10).box(0.08, 0.05, 0.4, "#f2f2f2", [0, 0.97, 0.22]) // bak + zolaq
        .box(0.3, 0.1, 0.62, SEAT, [0, 0.82, -0.38], [0.08, 0, 0]).box(0.28, 0.08, 0.3, PAINT, [0, 0.8, -0.78], [-0.15, 0, 0]) // oturacaq, quyruq
        .cyl(0.95, 0.05, 0.05, CHROME, [0, 0.62, 0.12], [-1.05, 0, 0], 6) // əsas boru
        .cyl(0.7, 0.04, 0.04, CHROME, [0.12, 0.42, -0.45], [1.25, 0, 0], 6).cyl(0.7, 0.04, 0.04, CHROME, [-0.12, 0.42, -0.45], [1.25, 0, 0], 6) // arxa çəngəl
        .cyl(0.95, 0.07, 0.09, CHROME, [0.2, 0.3, -0.48], [Math.PI / 2 - 0.12, 0, 0], 8).cyl(0.18, 0.1, 0.1, DARK, [0.2, 0.36, -0.98], [Math.PI / 2, 0, 0], 8) // egzoz
        .box(0.24, 0.05, 0.42, PAINT, [0, 0.78, -0.62], [0.35, 0, 0]) // arxa qanad
        .box(0.06, 0.32, 0.08, DARK, [0.16, 0.25, 0.0]).box(0.06, 0.32, 0.08, DARK, [-0.16, 0.25, 0.0]); // pedallar
      const m = k.build("motoBody", mat); m.parent = this.body; m.isPickable = false; }
    { const k = new Kit(scene); k.box(0.16, 0.06, 0.04, "#ff2a2a", [0, 0.82, -0.92]); const m = k.build("motoTail", glowMat(scene, "#ff2a2a", "motoTailGlow")); m.parent = this.body; m.isPickable = false; }
    // ön çəngəl + sükan + fara (sükanla birlikdə dönür)
    this.fork = new TransformNode("motoFork", scene); this.fork.parent = this.body; this.fork.position.set(0, 1.0, 0.62); this.fork.rotation.x = -0.42; // çəngəl qabağa meylli
    { const k = new Kit(scene);
      k.cyl(0.78, 0.05, 0.05, CHROME, [0.1, -0.33, 0], undefined, 6).cyl(0.78, 0.05, 0.05, CHROME, [-0.1, -0.33, 0], undefined, 6)
        .cyl(0.72, 0.035, 0.035, DARK, [0, 0.12, -0.06], [0, 0, Math.PI / 2], 6).box(0.1, 0.06, 0.06, DARK, [0.36, 0.12, -0.06]).box(0.1, 0.06, 0.06, DARK, [-0.36, 0.12, -0.06])
        .box(0.3, 0.05, 0.42, PAINT, [0, -0.3, 0.02], [-0.42, 0, 0]) // ön qanad
        .sph(0.26, DARK, [0, 0.0, 0.14], [1, 1, 0.8], 8);
      const m = k.build("motoForkM", mat); m.parent = this.fork; m.isPickable = false; }
    { const k = new Kit(scene); k.sph(0.18, "#fff3c8", [0, 0.0, 0.25], [1, 1, 0.4], 8); const m = k.build("motoLamp", glowMat(scene, "#fff3c8", "motoLampGlow")); m.parent = this.fork; m.isPickable = false; }
    this.front = wheel("motoFront"); this.front.parent = this.fork; this.front.position.set(0, -0.7, 0.0);
    this.rear = wheel("motoRear"); this.rear.parent = this.body; this.rear.position.set(0, WHEEL_R, -BASE / 2 - 0.05);
    // egzoz tüstüsü
    const sm = (this.smoke = new ParticleSystem("motoSmoke", 80, scene));
    sm.particleTexture = puffTex(scene); sm.emitter = Vector3.Zero(); sm.minSize = 0.12; sm.maxSize = 0.3; sm.minLifeTime = 0.4; sm.maxLifeTime = 0.9;
    sm.color1 = new Color4(0.5, 0.5, 0.5, 0.25); sm.color2 = new Color4(0.35, 0.35, 0.35, 0.2); sm.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    sm.minEmitPower = 0.3; sm.maxEmitPower = 0.8; sm.gravity = new Vector3(0, 0.8, 0); sm.emitRate = 0; sm.blendMode = ParticleSystem.BLENDMODE_STANDARD; sm.start();
    this.place();
  }

  get forward() { return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  /** sürücünün oturduğu nöqtə (dünya) */
  get seat() { return this.pos.add(new Vector3(0, 0.62, 0)).add(this.forward.scale(-0.3)); }
  get kmh() { return Math.abs(this.speed) * 3.6; }

  /** sürmə fizikası (arkada): sürətlənmə, sürtünmə, sükan, əyilmə, relyefə görə meyl, maneə toqquşması */
  update(dt: number, inp: MotoInput | null, grid: Grid) {
    const max = inp?.boost ? 36 : 25;
    if (inp) {
      if (inp.fw > 0) this.speed += (this.speed < 0 ? 16 : inp.boost ? 11 : 7) * dt;
      else if (inp.fw < 0) this.speed -= (this.speed > 0 ? 14 : 4) * dt;
      this.steer += (inp.st - this.steer) * Math.min(1, dt * 6);
    } else this.steer *= Math.max(0, 1 - dt * 4);
    if (!inp?.fw) this.speed *= Math.max(0, 1 - dt * (inp ? 0.5 : 1.5)); // qazı buraxanda yavaşlayır
    this.speed = Math.max(-6, Math.min(max, this.speed));
    if (Math.abs(this.speed) < 0.05 && !inp?.fw) this.speed = 0;
    // dönmə radiusu sürətə görə: yavaşda kəskin, sürətdə geniş
    const turn = this.steer * Math.min(1, Math.abs(this.speed) / 4) * (1.9 - Math.min(1.1, Math.abs(this.speed) / 30)) * Math.sign(this.speed || 1);
    this.yaw += turn * dt;
    this.pos.addInPlace(this.forward.scale(this.speed * dt));
    // maneələr: binaya çırpılanda geri itələnir və sürət itir
    for (const o of grid.near(this.pos.x, this.pos.z)) {
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.8;
      if (d < r && d > 1e-4) { this.pos.x = o.x + (dx / d) * r; this.pos.z = o.z + (dz / d) * r; if (Math.abs(this.speed) > 6) this.bump = 0.4; this.speed *= -0.25; }
    }
    const lim = HALF - 30;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    const f = this.forward, hf = heightAt(this.pos.x + f.x * BASE / 2, this.pos.z + f.z * BASE / 2), hb = heightAt(this.pos.x - f.x * BASE / 2, this.pos.z - f.z * BASE / 2);
    this.pos.y = (hf + hb) / 2;
    this.pitch += (-Math.atan2(hf - hb, BASE) - this.pitch) * Math.min(1, dt * 10);
    this.lean += (-turn * Math.min(1, Math.abs(this.speed) / 12) * 0.35 - this.lean) * Math.min(1, dt * 5);
    this.spin += (this.speed * dt) / WHEEL_R;
    this.bump = Math.max(0, this.bump - dt);
    (this.smoke.emitter as Vector3).copyFrom(this.pos.add(f.scale(-1.05)).add(new Vector3(0, 0.36, 0)));
    this.smoke.emitRate = inp ? 10 + Math.abs(this.speed) * 2 : 0;
    this.smoke.direction1 = f.scale(-1).add(new Vector3(-0.2, 0.2, -0.2)); this.smoke.direction2 = f.scale(-1).add(new Vector3(0.2, 0.5, 0.2));
    this.place();
  }
  private place() {
    this.root.position.copyFrom(this.pos); this.root.rotation.y = this.yaw;
    this.body.rotation.set(this.pitch, 0, this.lean);
    this.fork.rotation.y = this.steer * 0.45;
    this.front.rotation.x = this.spin; this.rear.rotation.x = this.spin;
  }
  dispose() { this.smoke.dispose(); this.root.dispose(); }
}
