// Döyüşçülər: samuray, ninja (dəstə), yeniçəri, Osmanlı (düşmən). AI: keşik/patrul → görür/eşidir → həyəcan → yaxınlaşır → vurur.
import { Mesh, Scene, Vector3, type InstancedMesh } from "@babylonjs/core";
import { UNITS, WEAPONS, type UnitType } from "./data";
import { canSee, Gun, heightAt, hitChance, type Grid } from "./logic";
import { unitModel } from "./kit";
import type { AnimState, CharLib } from "./chars";

/** animasiyalı personaj kitabxanası (yüklənibsə) */
let chars: CharLib | null = null;
export const setChars = (c: CharLib | null) => (chars = c);

export interface Target { pos: Vector3; alive: boolean; hit(dmg: number, from?: Vector3, kind?: string): void; ally: boolean; stealth?: number } // stealth: görünmə əmsalı (1 — adi)
export type Post = { y: number; face: number };
export type Ctx = {
  foes: Target[]; night: boolean; fog: number; leader: Vector3; order: "follow" | "attack"; grid: Grid; mates: Unit[];
  onShot: (from: Vector3, to: Vector3, hit: boolean, kind?: string) => void; slot: number; blocked?: (a: Vector3, b: Vector3) => boolean;
  /** yol göstərən: hədəfə birbaşa getmək olmursa aralıq nöqtə (məs. həyətdən darvaza ilə çıx) */
  via?: (from: Vector3, goal: Vector3) => Vector3;
};

const bases = new Map<string, Mesh>();
function baseMesh(scene: Scene, t: UnitType) {
  const b = bases.get(t.id);
  if (b && !b.isDisposed() && b.getScene() === scene) return b;
  const m = unitModel(scene, t.id);
  m.isVisible = false;
  bases.set(t.id, m);
  return m;
}

export class Unit implements Target {
  /** ölüm xəbəri (oyun: yaxındakı yoldaşlar meyitə baxmağa gəlir) */
  static onDeath: ((u: Unit) => void) | null = null;
  /** yıxılmaqda olanlar (oyun dövrəsi `Unit.tickFalls` çağırır) */
  static falling: Unit[] = [];
  private fallT = 0; private fallDur = 0; private kb: Vector3 | null = null; burned = false;
  mesh: InstancedMesh; hp: number; gun: Gun; facing = 0; target: Target | null = null;
  alert: Vector3 | null = null; fort = ""; route: { x: number; z: number }[] | null = null; private ri = 0; private dir = 1;
  stun = 0; acc = 0; dist = 0; private blk = false; // acc/dist — oyun dövrəsi üçün (uzaqdakılar seyrək yenilənir)
  private melee = false; private think = Math.random() * 0.25; private wp: Vector3; private bob = Math.random() * 6;
  anim: AnimState | null = null; private shotT = 0; private moved = 0; private want: AnimState = "idle"; private wantT = 0;
  far: InstancedMesh | null = null; near = false; // far — uzaq məsafə üçün sadə model
  /** dəstə əsgəri: bu nöqtədə dayanır (məs. topun yanında) — izləmə əmri onu aparmır */
  hold: Vector3 | null = null;
  constructor(scene: Scene, public type: UnitType, weaponId: string, public pos: Vector3, private home: Vector3, public post: Post | null = null) {
    let m: InstancedMesh | null = null;
    if (chars?.has(type.id)) try { m = chars.instance(type.id, "idle"); this.anim = "idle"; } catch { /* sadə modelə keç */ }
    this.mesh = m ?? baseMesh(scene, type).createInstance(type.id);
    this.mesh.metadata = { unit: this };
    if (m) { this.far = baseMesh(scene, type).createInstance(type.id + "_far"); this.far.metadata = { unit: this }; this.mesh.isVisible = false; this.mesh.isPickable = false; if (type.civ) this.far.isPickable = false; } // vurma yoxlaması sadə model üzrə (görünməsə də)
    if (type.civ) this.mesh.isPickable = false; // güllə mülkilərdən keçir
    this.hp = type.hp;
    this.gun = new Gun(WEAPONS[weaponId] ?? WEAPONS[type.weapons[0]] ?? WEAPONS.scimitar);
    this.wp = home.clone();
    if (post) this.facing = post.face;
    this.place();
  }
  get ally() { return this.type.ally; }
  get alive() { return this.hp > 0; }
  hit(dmg: number, from?: Vector3, kind?: string) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      Unit.onDeath?.(this);
      this.burned = kind === "fire";
      this.fall(from);
    }
  }
  /** real yıxılma: zərbə gələn tərəfə dönür, geri itələnir, Death01 əvvəldən oynayır, sonra yerdə uzanır */
  private fall(from?: Vector3) {
    this.mesh.isPickable = false;
    if (this.far) this.far.isPickable = false;
    if (from) {
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
      this.facing = Math.atan2(-dx, -dz); // hücum edənə üz tutub arxası üstə yıxılır
      this.kb = new Vector3(dx / d, 0, dz / d).scale(this.burned ? 0.6 : 1.1);
    }
    const dying = chars && this.anim && this.near ? chars.dying(this.type.id, performance.now() / 1000) : null;
    if (dying) {
      const old = this.mesh;
      this.mesh = dying.inst; this.mesh.metadata = old.metadata; this.mesh.isPickable = false; this.mesh.isVisible = old.isVisible;
      old.dispose(); this.fallDur = dying.dur; this.anim = "attack"; // müvəqqəti: bitəndə "dead"-ə keçir
    } else if (this.anim) { this.setAnim("dead"); this.fallDur = 0.35; }
    else this.fallDur = 0.45;
    this.fallT = 0; Unit.falling.push(this); this.place();
  }
  /** yıxılanları yenilə: itələnmə (ilk 0.35 s), sadə modeldə yavaş aşma, animasiya bitəndə uzanmış şablona keç */
  static tickFalls(dt: number) {
    for (let i = Unit.falling.length - 1; i >= 0; i--) {
      const u = Unit.falling[i]; u.fallT += dt;
      if (u.kb && u.fallT < 0.35) { const k = (1 - u.fallT / 0.35) * dt * 4; u.pos.x += u.kb.x * k; u.pos.z += u.kb.z * k; }
      u.place();
      const p = Math.min(1, u.fallT / 0.45), tilt = -Math.PI / 2 * (p * p * (3 - 2 * p)); // yumşaq aşma (sadə model)
      if (!u.anim) { u.mesh.rotation.x = tilt; u.mesh.position.y += 0.3 * p; }
      if (u.far) { u.far.rotation.x = tilt; u.far.position.y += 0.3 * p; }
      if (u.fallT >= u.fallDur) {
        if (u.anim === "attack") { u.anim = "walk"; u.setAnim("dead"); u.mesh.isPickable = false; }
        Unit.falling.splice(i, 1);
      }
    }
  }
  /** animasiya halı dəyişəndə instance başqa şablona keçir */
  /** görünmə: yaxında animasiyalı model, uzaqda sadə, çox uzaqda heç biri */
  setLod(near: boolean, visible: boolean) {
    if (!this.far) { this.mesh.isVisible = visible; return; }
    this.near = near && visible; this.mesh.isVisible = this.near; this.far.isVisible = visible && !near;
  }
  setAnim(s: AnimState) {
    if (!chars || !this.anim || this.anim === s) return;
    const old = this.mesh;
    try { this.mesh = chars.instance(this.type.id, s); } catch { return; }
    this.mesh.metadata = old.metadata; this.mesh.isPickable = false; this.mesh.isVisible = old.isVisible;
    if (this.type.civ) this.mesh.isPickable = false;
    this.anim = s; old.dispose(); this.place();
  }
  /** maqnit: tüfəngi əlindən alınır — qılınca keçir */
  disarm() { if (!this.gun.w.melee) this.gun = new Gun(WEAPONS.scimitar); }
  /** başqa yerə köçür (məs. məhəllə keşikçisi): orada gəzir */
  relocate(x: number, z: number) { this.route = null; this.pos.set(x, 0, z); this.home.set(x, 0, z); this.wp.set(x, 0, z); this.place(); }
  setRoute(r: { x: number; z: number }[]) {
    this.route = r; this.ri = Math.floor(Math.random() * r.length); this.dir = Math.random() < 0.5 ? 1 : -1;
    const p = r[this.ri]; this.pos.set(p.x, 0, p.z); this.wp.set(p.x, 0, p.z); this.place();
  }
  private place() {
    this.pos.y = this.post ? this.post.y : heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copyFrom(this.pos);
    this.mesh.rotation.y = this.facing;
    if (this.far) { this.far.position.copyFrom(this.pos); this.far.rotation.y = this.facing; }
    if (this.anim) { // skeletli instance-da glTF kökünün güzgüsü dünya fəzasında tətbiq olunur: x və fırlanma əks çevrilir — burada kompensasiya
      if (this.mesh.scaling.x > 0) this.mesh.scaling.x = -1;
      this.mesh.position.x = -this.pos.x; this.mesh.rotation.y = -this.facing;
    }
  }

  update(dt: number, ctx: Ctx) {
    if (!this.alive) return;
    if (this.stun > 0) { this.stun -= dt; this.setAnim("idle"); return; } // donub / tora düşüb
    this.shotT -= dt; this.moved = 0;
    this.gun.update(dt);
    if (!this.type.civ && (this.think -= dt) <= 0) { // mülkilər döyüşmür // saniyədə 4 dəfə «düşünür» — prosessor qənaəti
      this.think = 0.25;
      if (this.target && !this.target.alive) this.target = null;
      const had = this.target, k = this.post ? 1.6 : 1; // hündürdəki keşikçi uzağı görür
      let best: Target | null = null, bd = 1e9;
      for (const f of ctx.foes) {
        if (!f.alive) continue;
        const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z, d = dx * dx + dz * dz;
        const sv = k * (f.stealth ?? 1); // görünməz/balaca hədəfi görmək çətindir
        if (d < bd && ((this.target === f && sv > 0.3 * k) || canSee(dx / sv, dz / sv, this.facing, ctx.night, false, ctx.fog) || (this.ally && d < 900))) { bd = d; best = f; }
      }
      this.target = best;
      if (!had && this.target && !this.ally) { // həyəcan: yalnız ən yaxın 4 yoldaş (30 m) gəlir — hamısı birdən tökülmür
        const near = ctx.mates.filter((m) => m !== this && m.alive && !m.target && !m.alert && !m.post && Vector3.DistanceSquared(m.pos, this.pos) < 900);
        near.sort((a, b) => Vector3.DistanceSquared(a.pos, this.pos) - Vector3.DistanceSquared(b.pos, this.pos));
        for (const m of near.slice(0, 4)) m.alert = this.target.pos.clone();
      }
      const tp = this.target?.pos; // divar/ev arxasındadırsa atmır (saniyədə 4 yoxlama)
      this.blk = !!(tp && !this.gun.w.melee && ctx.blocked && Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z) > 3 && ctx.blocked(this.pos.add(new Vector3(0, 1.5, 0)), tp.add(new Vector3(0, 1.2, 0))));
    }
    let goal: Vector3 | null = null, speed = this.type.speed * 0.6;
    const w = this.gun.w;
    if (this.target) {
      const d = Math.hypot(this.pos.x - this.target.pos.x, this.pos.z - this.target.pos.z);
      const bay = !!w.bayonet && d < 3; // süngü: yaxında tüfənglə deyil, süngü ilə
      const charge = !!w.bayonet && this.ally && ctx.order === "attack" && d < 40; // hücum əmrində 40 m-dən süngü həmləsi
      const want = w.melee || charge ? 2 : Math.min(w.range * 0.6, 25);
      const blocked = this.blk;
      if (d > want || blocked) { goal = this.target.pos; speed = this.type.speed * 1.3; }
      this.face(this.target.pos);
      if (bay && this.shotT <= -0.4) { // süngü zərbəsi (sursat xərcləmir)
        this.shotT = 0.7; this.melee = true;
        if (Math.random() < 0.7) this.target.hit(55 * (0.8 + Math.random() * 0.4), this.pos, "bayonet");
      } else if (!bay && d <= w.range && !blocked && this.gun.fire()) {
        this.shotT = 0.7; this.melee = false;
        const hit = Math.random() < hitChance(w, d);
        if (hit) this.target.hit(w.dmg * (0.8 + Math.random() * 0.4), this.pos);
        if (!w.melee) ctx.onShot(this.pos.add(new Vector3(0, 1.5, 0)), this.target.pos.add(new Vector3(0, 1.2, 0)), hit, w.id);
      }
    } else if (this.ally) {
      const ring = Math.floor(ctx.slot / 12), ang = ((ctx.slot % 12) / 12) * Math.PI * 2 + ring * 0.3, rr = 4 + ring * 2.5; // dəstə halqalarla izləyir
      if (ctx.order === "attack" && this.alert && Math.hypot(this.alert.x - this.pos.x, this.alert.z - this.pos.z) < 6) this.alert = null;
      if (ctx.order === "attack" && !this.alert && (this.think > 0.2)) { // növbəti hədəf: ən yaxın canlı düşmən (200 m)
        let bd = 40000; for (const f of ctx.foes) { if (!f.alive) continue; const d = (f.pos.x - this.pos.x) ** 2 + (f.pos.z - this.pos.z) ** 2; if (d < bd) { bd = d; this.alert = f.pos.clone(); } }
      }
      goal = this.hold ? this.hold : ctx.order === "follow" ? ctx.leader.add(new Vector3(Math.cos(ang) * rr, 0, Math.sin(ang) * rr)) : this.alert;
      const far = goal ? Vector3.Distance(goal, this.pos) : 0;
      speed = this.type.speed * (far > 40 ? 2 : far > 10 ? 1.3 : 0.7); // geri qalanda tələsir
    } else if (this.alert) {
      goal = this.alert; speed = this.type.speed * 1.2;
      if (Math.hypot(this.pos.x - this.alert.x, this.pos.z - this.alert.z) < 3) this.alert = null;
    } else if (this.route) { // küçə patrulu
      if (Math.hypot(this.pos.x - this.wp.x, this.pos.z - this.wp.z) < 2) {
        if (Math.random() < 0.08) this.dir = -this.dir;
        this.ri = (this.ri + this.dir + this.route.length) % this.route.length;
        const p = this.route[this.ri]; this.wp.set(p.x + (Math.random() - 0.5) * 3, 0, p.z + (Math.random() - 0.5) * 3);
      }
      goal = this.wp;
    } else if (!this.post) {
      if (Math.hypot(this.pos.x - this.wp.x, this.pos.z - this.wp.z) < 2) this.wp = this.home.add(new Vector3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30));
      goal = this.wp;
    }
    if (this.post) goal = null; // keşikçi yerindən tərpənmir
    if (goal) this.move(ctx.via ? ctx.via(this.pos, goal) : goal, speed * dt, ctx.grid, ctx.mates);
    this.place();
    if (this.anim) { // hal 0.3 s dəyişməz qalanda keçid (titrəmə olmasın); uzaqda heç keçmir
      const s: AnimState = this.shotT > 0 ? (w.melee || this.melee ? "attack" : "shoot") : this.moved > 0.004 ? (speed > this.type.speed ? "run" : "walk") : "idle";
      if (s !== this.want) { this.want = s; this.wantT = 0; } else this.wantT += dt;
      if (this.near && (this.wantT > 0.3 || s === "attack" || s === "shoot")) this.setAnim(s);
    }
    else if (goal && !this.post) this.mesh.position.y += Math.abs(Math.sin((this.bob += dt * speed * 2.2))) * 0.08; // addım
  }

  private face(p: Vector3) { this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  private move(goal: Vector3, step: number, grid: Grid, mates: Unit[]) {
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5) return;
    let vx = dx / d, vz = dz / d;
    for (const o of grid.near(this.pos.x, this.pos.z)) { // maneələrdən kənara
      const ox = this.pos.x - o.x, oz = this.pos.z - o.z, od = Math.hypot(ox, oz);
      if (od < o.r + 2 && od > 1e-3) { vx += (ox / od) * 1.5; vz += (oz / od) * 1.5; }
    }
    if (mates.length < 120) for (const m of mates) { // böyük ordularda bu yoxlama atlanır (performans)
      if (m === this || !m.alive) continue;
      const mx = this.pos.x - m.pos.x, mz = this.pos.z - m.pos.z, md = mx * mx + mz * mz;
      if (md < 1.2 && md > 1e-4) { vx += (mx / md) * 0.3; vz += (mz / md) * 0.3; }
    }
    const n = Math.hypot(vx, vz) || 1;
    this.pos.x += (vx / n) * Math.min(step, d);
    this.pos.z += (vz / n) * Math.min(step, d);
    this.moved = Math.min(step, d);
    for (const o of grid.near(this.pos.x, this.pos.z)) { // divarın içinə girməsin
      const ox = this.pos.x - o.x, oz = this.pos.z - o.z, od = Math.hypot(ox, oz), r = o.r + 0.5;
      if (od < r && od > 1e-3) { this.pos.x = o.x + (ox / od) * r; this.pos.z = o.z + (oz / od) * r; }
    }
    if (!this.target) this.facing = Math.atan2(vx, vz);
  }
}

export function spawn(scene: Scene, typeId: string, weaponId: string, n: number, cx: number, cz: number, spread: number) {
  const t = UNITS[typeId];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
    return new Unit(scene, t, weaponId, new Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r), new Vector3(cx, 0, cz));
  });
}
