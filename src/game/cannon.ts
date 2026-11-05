// Top: xidmətçisi sağ və qəsr həyəcanda olanda hədəfə mərmi atır. Yerdə qırmızı halqa — xəbərdarlıq.
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3, type AbstractMesh, type AssetContainer } from "@babylonjs/core";
import type { Target, Unit } from "./units";

let shared: { shell: StandardMaterial; ring: StandardMaterial; boom: StandardMaterial } | null = null;
function mats(scene: Scene) {
  if (shared && shared.shell.getScene() === scene && !shared.shell.isFrozen) return shared;
  const m = (hex: string, em = false) => { const s = new StandardMaterial("c" + hex, scene); s.diffuseColor = Color3.FromHexString(hex); if (em) { s.emissiveColor = s.diffuseColor; s.disableLighting = true; s.fogEnabled = false; } return s; };
  const ring = m("#ff2a1a", true); ring.alpha = 0.55;
  return (shared = { shell: m("#151515"), ring, boom: m("#ffb040", true) });
}

export class Cannon implements Target {
  ally = false; hp = 150; private cool = 10 + Math.random() * 6;
  private fl: { a: Vector3; b: Vector3; t: number; dur: number } | null = null; private boomT = 0;
  private shell: Mesh; private ring: Mesh; private boom: Mesh;
  inst: AbstractMesh;
  constructor(scene: Scene, base: Mesh, public pos: Vector3, public face: number, public crew: Unit | null) {
    const inst = (this.inst = base.createInstance("cannon"));
    inst.position.copyFrom(pos); inst.rotation.y = face; inst.metadata = { unit: this };
    const M = mats(scene);
    this.shell = MeshBuilder.CreateSphere("shell", { diameter: 0.5, segments: 4 }, scene); this.shell.material = M.shell;
    this.ring = MeshBuilder.CreateTorus("ring", { diameter: 9, thickness: 0.35, tessellation: 24 }, scene); this.ring.material = M.ring;
    this.boom = MeshBuilder.CreateSphere("boom", { diameter: 1, segments: 6 }, scene); this.boom.material = M.boom;
    for (const m of [this.shell, this.ring, this.boom]) { m.isPickable = false; m.setEnabled(false); }
  }
  /** sadə modeli real (Poly Haven) top modeli ilə əvəz edir */
  useModel(c: AssetContainer) {
    const e = c.instantiateModelsToScene((n) => n, false), holder = new TransformNode("cannonHolder", this.inst.getScene());
    holder.position.copyFrom(this.pos); holder.rotation.y = this.face + Math.PI / 2; holder.scaling.setAll(1.3);
    for (const r of e.rootNodes) r.parent = holder;
    for (const m of holder.getChildMeshes()) m.metadata = { unit: this };
    this.inst.setEnabled(false);
  }
  get alive() { return this.hp > 0 && !!this.crew?.alive; }
  hit(d: number) { this.hp -= d; }

  /** qaytarır: yeni atəş açıldısa hədəf */
  update(dt: number, foes: Target[], alarmed: boolean, groundY: (x: number, z: number) => number): Target | null {
    if (this.boomT > 0 && (this.boomT -= dt) <= 0) this.boom.setEnabled(false);
    if (this.fl) {
      const f = this.fl; f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      this.shell.position.copyFrom(Vector3.Lerp(f.a, f.b, k)).addInPlaceFromFloats(0, Math.sin(k * Math.PI) * f.dur * 9, 0);
      if (k >= 1) { // partlayış: 6 m radiusda zərər
        for (const t of foes) { const d = Vector3.Distance(t.pos, f.b); if (t.alive && d < 6) t.hit(75 * (1 - d / 7)); }
        this.shell.setEnabled(false); this.ring.setEnabled(false);
        this.boom.position.copyFrom(f.b); this.boom.scaling.setAll(7); this.boom.setEnabled(true); this.boomT = 0.18;
        this.fl = null;
      }
    }
    if (!this.alive || !alarmed || this.fl || (this.cool -= dt) > 0) return null;
    let best: Target | null = null, bd = 130;
    for (const t of foes) { const d = Vector3.Distance(t.pos, this.pos); if (t.alive && d > 20 && d < bd) { bd = d; best = t; } }
    if (!best) return null;
    const b = best.pos.clone(); b.y = groundY(b.x, b.z);
    this.fl = { a: this.pos.add(new Vector3(0, 1.2, 0)), b, t: 0, dur: 1.6 + bd / 110 };
    this.ring.position.set(b.x, b.y + 0.3, b.z); this.ring.setEnabled(true); this.shell.setEnabled(true);
    this.cool = 15 + Math.random() * 7;
    return best;
  }
}
