// Döyüşçülər: samuray, ninja (dəstə), Osmanlı, Monqol (düşmən). Sadə AI: patrul → görür/eşidir → yaxınlaşır → vurur.
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3, type InstancedMesh } from "@babylonjs/core";
import { UNITS, WEAPONS, type UnitType } from "./data";
import { canSee, Gun, heightAt, hitChance } from "./logic";

export interface Target { pos: Vector3; alive: boolean; hit(dmg: number): void; ally: boolean }
type Obstacle = { x: number; z: number; r: number };

const bases: Record<string, Mesh> = {};
function baseMesh(scene: Scene, t: UnitType) {
  if (bases[t.id] && !bases[t.id].isDisposed()) return bases[t.id];
  const body = MeshBuilder.CreateCylinder("b", { height: 1.3, diameterTop: 0.7, diameterBottom: 0.55, tessellation: 7 }, scene);
  body.position.y = 0.95;
  const head = MeshBuilder.CreateSphere("h", { diameter: 0.5, segments: 4 }, scene);
  head.position.y = 1.85;
  const hat = MeshBuilder.CreateCylinder("hat", { height: 0.3, diameterTop: t.id === "samurai" ? 1.1 : 0.4,
    diameterBottom: t.id === "ottoman" ? 0.45 : 0.6, tessellation: 6 }, scene);
  hat.position.y = 2.15;
  const m = Mesh.MergeMeshes([body, head, hat], true, true)!;
  const mat = new StandardMaterial("u" + t.id, scene);
  mat.diffuseColor = Color3.FromHexString(t.color);
  mat.specularColor = Color3.Black();
  m.material = mat;
  m.isVisible = false;
  return (bases[t.id] = m);
}

export class Unit implements Target {
  mesh: InstancedMesh; hp: number; gun: Gun; facing = 0; target: Target | null = null;
  alert: Vector3 | null = null; private think = Math.random() * 0.25; private wp: Vector3;
  constructor(scene: Scene, public type: UnitType, weaponId: string, public pos: Vector3, private home: Vector3) {
    this.mesh = baseMesh(scene, type).createInstance(type.id);
    this.mesh.metadata = { unit: this };
    this.hp = type.hp;
    this.gun = new Gun(WEAPONS[weaponId] ?? WEAPONS[type.weapons[0]]);
    this.wp = home.clone();
  }
  get ally() { return this.type.ally; }
  get alive() { return this.hp > 0; }
  hit(dmg: number) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.mesh.rotation.x = Math.PI / 2; this.mesh.position.y -= 0.6; this.mesh.isPickable = false; }
  }

  /** ctx: görünə bilən hədəflər, gecə/duman, oyunçu (dəstə üçün lider), əmr */
  update(dt: number, ctx: { foes: Target[]; night: boolean; fog: number; leader: Vector3; order: "follow" | "attack";
    obstacles: Obstacle[]; mates: Unit[]; onShot: (from: Vector3, to: Vector3, hit: boolean) => void; slot: number }) {
    if (!this.alive) return;
    this.gun.update(dt);
    if ((this.think -= dt) <= 0) { // «düşünmək» saniyədə 4 dəfə — prosessor qənaəti
      this.think = 0.25;
      if (this.target && !this.target.alive) this.target = null;
      let best: Target | null = null, bd = 1e9;
      for (const f of ctx.foes) {
        if (!f.alive) continue;
        const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z;
        const d = dx * dx + dz * dz;
        if (d < bd && (this.target === f || canSee(dx, dz, this.facing, ctx.night, false, ctx.fog) || (this.ally && d < 900))) { bd = d; best = f; }
      }
      if (best) this.target = best;
    }
    let goal: Vector3 | null = null, run = false;
    const w = this.gun.w;
    if (this.target) {
      const d = Vector3.Distance(this.pos, this.target.pos);
      const want = w.melee ? w.range * 0.8 : Math.min(w.range * 0.6, 25);
      if (d > want) { goal = this.target.pos; run = true; }
      this.face(this.target.pos);
      if (d <= w.range && this.gun.fire()) {
        const hit = Math.random() < hitChance(w, d);
        if (hit) this.target.hit(w.dmg * (0.8 + Math.random() * 0.4));
        if (!w.melee) ctx.onShot(this.pos, this.target.pos, hit);
      }
    } else if (this.ally) {
      const ang = (ctx.slot / Math.max(1, ctx.mates.length)) * Math.PI * 2;
      goal = ctx.order === "follow" ? ctx.leader.add(new Vector3(Math.cos(ang) * 5, 0, Math.sin(ang) * 5)) : this.alert;
      run = ctx.order === "attack";
    } else if (this.alert) {
      goal = this.alert;
      if (Vector3.Distance(this.pos, this.alert) < 3) this.alert = null;
    } else { // patrul
      if (Vector3.Distance(this.pos, this.wp) < 2) {
        this.wp = this.home.add(new Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40));
      }
      goal = this.wp;
    }
    if (goal) this.move(goal, this.type.speed * (run ? 1.3 : 0.6) * dt, ctx.obstacles, ctx.mates);
    this.mesh.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z), this.pos.z);
    this.mesh.rotation.y = this.facing;
  }

  private face(p: Vector3) { this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  private move(goal: Vector3, step: number, obs: Obstacle[], mates: Unit[]) {
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5) return;
    let vx = dx / d, vz = dz / d;
    for (const o of obs) { // maneələrdən kənara itələ
      const ox = this.pos.x - o.x, oz = this.pos.z - o.z, od = Math.hypot(ox, oz);
      if (od < o.r + 2) { vx += (ox / od) * 1.5; vz += (oz / od) * 1.5; }
    }
    for (const m of mates) { // bir-birinin içinə girməsinlər
      if (m === this || !m.alive) continue;
      const mx = this.pos.x - m.pos.x, mz = this.pos.z - m.pos.z, md = mx * mx + mz * mz;
      if (md < 1.2 && md > 1e-4) { vx += mx / md * 0.3; vz += mz / md * 0.3; }
    }
    const n = Math.hypot(vx, vz) || 1;
    this.pos.x += (vx / n) * Math.min(step, d);
    this.pos.z += (vz / n) * Math.min(step, d);
    if (!this.target) this.facing = Math.atan2(vx, vz);
  }
}

export function spawn(scene: Scene, typeId: string, weaponId: string, n: number, cx: number, cz: number, spread: number) {
  const t = UNITS[typeId];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
    const p = new Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
    return new Unit(scene, t, weaponId, p, new Vector3(cx, 0, cz));
  });
}
