// Döyüşçülər: samuray, ninja (dəstə), yeniçəri, Osmanlı (düşmən). AI: keşik/patrul → görür/eşidir → həyəcan → yaxınlaşır → vurur.
import { Mesh, Scene, Vector3, type InstancedMesh } from "@babylonjs/core";
import { UNITS, WEAPONS, type UnitType } from "./data";
import { canSee, Gun, heightAt, hitChance, type Grid } from "./logic";
import { unitModel } from "./kit";
import type { AnimState, CharLib } from "./chars";

/** animasiyalı personaj kitabxanası (yüklənibsə) */
let chars: CharLib | null = null;
export const setChars = (c: CharLib | null) => (chars = c);

export interface Target { pos: Vector3; alive: boolean; hit(dmg: number, from?: Vector3, kind?: string): void; ally: boolean; stealth?: number;
  /** vurulma ehtimalının əmsalı (əyilib/uzanıb/yuvarlanır — az) */ evade?: number; /** ona atəş açıldı (yayınma, sığınacaq) */ shotAt?(from: Vector3): void }
/** sığınacaq: qaya, ot tayası... (n — arxasındakı əsgər sayı) */
export type Cover = { cap?: number; x: number; z: number; r: number; h: number; n: number }; // stealth: görünmə əmsalı (1 — adi)
export type Post = { y: number; face: number };
export type Ctx = {
  foes: Target[]; night: boolean; fog: number; leader: Vector3; order: "follow" | "attack"; grid: Grid; mates: Unit[];
  onShot: (from: Vector3, to: Vector3, hit: boolean, kind?: string) => void; slot: number; blocked?: (a: Vector3, b: Vector3) => boolean;
  /** yol göstərən: hədəfə birbaşa getmək olmursa aralıq nöqtə (məs. həyətdən darvaza ilə çıx) */
  via?: (from: Vector3, goal: Vector3) => Vector3;
  /** sığınacaqlar (qayalar və s.) — Grid-də */
  covers?: Grid;
  /** düşmən də bizim əsgərlər kimi: hər tərəfi görür, süngü həmləsi, 10-luq qrup */ aware?: boolean;
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
  /** duruş: ayaqda / əyilib (diz üstə) / uzanıb */
  stance: "stand" | "crouch" | "prone" = "stand";
  /** hücum qrupunun hədəf nöqtəsi (oyun hər 0.5 s verir) */
  squadGoal: Vector3 | null = null;
  private prefProne = Math.random() < 0.5; private fireT = 0; private rollT = 0; private rollV = new Vector3(); private rollCd = Math.random() * 3;
  private cover: Cover | null = null; private coverT = 0; private coverCd = 0; private peekT = Math.random() * 2; private peek = true; private side = Math.random() < 0.5 ? 1 : -1;
  private hidePos = new Vector3(); private peekPos = new Vector3();
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
  get evade() {
    if (this.rollT > 0) return 0.25;
    if (this.type.beast) return this.moved > 0.004 ? 0.4 : 0.7; // qaçan heyvan: balaca, sürətli hədəf
    if (this.stance === "prone") return 0.35;
    if (this.stance === "crouch") return this.post || this.cover ? 0.2 : 0.55; // səngərdə/qaya arxasında əyilib — çətin vurulur
    return 1;
  }
  /** güllə yanından keçdi / vuruldu: bir müddət «atəş altında»; açıqdadırsa bəzən yana yuvarlanır */
  shotAt(from: Vector3) {
    this.fireT = 3;
    if (this.type.beast || this.post || this.hold || this.cover || this.rollT > 0 || this.rollCd > 0 || this.stance === "prone" || !this.alive || Math.random() > 0.3) return;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1, s = Math.random() < 0.5 ? 1 : -1;
    this.rollV.set((-dz / d) * s * 4.2, 0, (dx / d) * s * 4.2); this.rollT = 0.8; this.rollCd = 4 + Math.random() * 4;
  }
  private freeCover() { if (this.cover) { this.cover.n--; this.cover = null; } }
  /** yaxın sığınacaq tap (hədəfə görə arxa tərəf + yandan baxma nöqtəsi); near — axtarış mərkəzi (dəstədəki yer, qrup hədəfi) */
  private takeCover(ctx: Ctx, from: Vector3, near: Vector3, maxD: number) {
    if (!ctx.covers || this.coverCd > 0) return false;
    let best: Cover | null = null, bd = 1e9;
    for (const o of ctx.covers.near(near.x, near.z) as Cover[]) {
      if (o.n >= (o.cap ?? (o.r > 1.8 ? 3 : 2))) continue;
      const dn = (o.x - near.x) ** 2 + (o.z - near.z) ** 2, d = (o.x - this.pos.x) ** 2 + (o.z - this.pos.z) ** 2, de = (o.x - from.x) ** 2 + (o.z - from.z) ** 2;
      if (dn < maxD * maxD && d < 45 * 45 && de > 64 && d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    this.freeCover(); this.cover = best; best.n++; this.coverT = 6 + Math.random() * 6; this.setCoverPts(from);
    return true;
  }
  private setCoverPts(from: Vector3) {
    const o = this.cover!; let ax = o.x - from.x, az = o.z - from.z; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
    const k = o.r + 0.8; this.hidePos.set(o.x + ax * k, 0, o.z + az * k);
    this.peekPos.set(this.hidePos.x - az * this.side * (o.r * 0.8 + 0.6), 0, this.hidePos.z + ax * this.side * (o.r * 0.8 + 0.6));
  }
  hit(dmg: number, from?: Vector3, kind?: string) {
    if (!this.alive) return;
    if (from) this.shotAt(from);
    this.hp -= dmg;
    if (this.hp <= 0) {
      Unit.onDeath?.(this); this.freeCover(); this.stance = "stand";
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
    if (this.far) {
      this.far.position.copyFrom(this.pos); this.far.rotation.y = this.facing;
      if (this.alive) { // uzaqda da görünsün: əyilib — alçaq, uzanıb — yerə yatır
        this.far.scaling.y = this.stance === "crouch" ? 0.62 : 1;
        this.far.rotation.x = this.stance === "prone" ? Math.PI / 2 : 0; if (this.stance === "prone") this.far.position.y += 0.25;
      }
    }
    if (this.anim) { // skeletli instance-da glTF kökünün güzgüsü dünya fəzasında tətbiq olunur: x və fırlanma əks çevrilir — burada kompensasiya
      if (this.mesh.scaling.x > 0) this.mesh.scaling.x = -1;
      this.mesh.position.x = -this.pos.x; this.mesh.rotation.y = -this.facing;
    }
  }

  update(dt: number, ctx: Ctx) {
    if (!this.alive) return;
    if (this.stun > 0) { this.stun -= dt; this.setAnim("idle"); return; } // donub / tora düşüb
    this.shotT -= dt; this.moved = 0; this.rollCd -= dt; this.fireT -= dt; this.coverCd -= dt;
    this.gun.update(dt);
    if (this.rollT > 0) { // yana yuvarlanır (güllədən qaçır)
      this.rollT -= dt; this.stance = "stand";
      this.move(this.pos.add(this.rollV), this.rollV.length() * dt, ctx.grid, ctx.mates); this.facing = Math.atan2(this.rollV.x, this.rollV.z);
      this.place(); if (this.near) this.setAnim("roll"); return;
    }
    if (!this.type.civ && (this.think -= dt) <= 0) { // mülkilər döyüşmür // saniyədə 4 dəfə «düşünür» — prosessor qənaəti
      this.think = 0.25;
      if (this.target && !this.target.alive) this.target = null;
      const had = this.target, k = this.post ? 1.6 : 1; // hündürdəki keşikçi uzağı görür
      let best: Target | null = null, bd = 1e9;
      for (const f of ctx.foes) {
        if (!f.alive) continue;
        const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z, d = dx * dx + dz * dz;
        const sv = k * (f.stealth ?? 1); // görünməz/balaca hədəfi görmək çətindir
        if (d < bd && ((this.target === f && sv > 0.3 * k) || canSee(dx / sv, dz / sv, this.facing, ctx.night, false, ctx.fog) || ((this.ally || ctx.aware) && d < (!f.stealth ? (this.gun.w.range * 0.8) ** 2 : 900)))) { bd = d; best = f; } // döyüşdə əsgər hər tərəfə baxır: tüfəng məsafəsindəki düşməni görür
      }
      this.target = best;
      if (!best && (this.cover || this.stance !== "stand")) { this.freeCover(); this.stance = "stand"; this.peek = true; } // döyüş bitdi — ayağa qalx
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
      const charge = !!w.bayonet && !this.post && (this.ally ? ctx.order === "attack" : !!ctx.aware) && d < 40; // hücum əmrində 40 m-dən süngü həmləsi
      const want = w.melee || charge ? 2 : Math.min(w.range * 0.6, 25);
      const blocked = this.blk;
      // səngərdəki keşikçi: əyilib gizlənir, qalxıb atır (2–3.5 s gizli, 1.5–2.5 s atəş)
      if (this.post && !w.melee) {
        this.peekT -= dt;
        if (this.peekT <= 0) { this.peek = !this.peek; this.peekT = this.peek ? 1.5 + Math.random() : 2 + Math.random() * 1.5; }
        this.stance = this.peek ? "stand" : "crouch";
      }
      // «izlə» əmrində: dəstədən ayrılıb düşmənin dalınca qaçmır — sənin yanında qalıb atır (özünü və səni qoruyur); topçu topun yanında qalır
      const stay = this.ally && !charge && !w.melee && (this.hold || ctx.order === "follow");
      const squad = !charge && !w.melee && !this.hold && !this.post && (this.ally ? ctx.order === "attack" : !!ctx.aware) ? this.squadGoal : null;
      if (stay) { goal = this.hold ?? this.slotPos(ctx); if (Vector3.Distance(goal, this.pos) < 2) goal = null; else speed = this.type.speed * (Vector3.Distance(goal, this.pos) > 15 ? 1.6 : 1); }
      else if (squad) { goal = Vector3.Distance(squad, this.pos) > 2 ? squad : null; speed = this.type.speed * 1.15; } // 10-luq qrup öz zolağında irəliləyir
      else if (d > want || blocked) {
        goal = this.target.pos; speed = this.type.speed * 1.3;
        if (!this.ally && !this.type.beast && !w.melee && this.fireT > 0 && d < 110) { // atəş altında sıçrayışlarla irəliləyir: qaçır, yatıb atır, yenə qaçır
          this.peekT -= dt;
          if (this.peekT <= 0) { this.peek = !this.peek; this.peekT = this.peek ? 1.5 + Math.random() * 1.5 : 2 + Math.random() * 2; }
          if (!this.peek) goal = null;
        }
      }
      // sığınacaq: atəş altında (və ya mövqedə) yaxındakı qaya/taya arxasına keçir, oradan yandan baxıb atır
      if (!this.post && !this.hold && !w.melee && !charge && !this.type.beast && d > 8) {
        if (!this.cover && (this.fireT > 0 || !goal) && this.think > 0.2) this.takeCover(ctx, this.target.pos, stay ? this.slotPos(ctx) : squad ?? this.pos, squad ? 28 : 22);
        if (this.cover) {
          this.coverT -= dt;
          const leaderFar = stay && !this.hold && Vector3.Distance(this.slotPos(ctx), this.hidePos) > 22;
          if (this.coverT <= 0 || leaderFar || (squad && this.fireT <= 0 && this.coverT < 3)) { this.freeCover(); this.coverCd = 4 + Math.random() * 3; }
          else {
            this.setCoverPts(this.target.pos);
            this.peekT -= dt;
            if (this.peekT <= 0) { this.peek = !this.peek; this.peekT = this.peek ? 1.4 + Math.random() * 1.2 : 1.5 + Math.random() * 1.8; }
            goal = this.peek ? this.peekPos : this.hidePos; speed = this.type.speed;
            if (Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 0.6) goal = null;
          }
        }
      }
      // duruş: qaya arxasında əyilir; açıqda dayanıb atanda — uzanır və ya diz üstə; qaçanda ayaqda
      if (!this.post && !this.type.beast) {
        if (this.cover) this.stance = this.peek && this.cover.h > 2.2 ? "stand" : "crouch";
        else if (!goal) this.stance = this.fireT > 0 || d < 90 ? (this.prefProne ? "prone" : "crouch") : "stand";
        else this.stance = "stand";
      }
      this.face(this.target.pos);
      if (bay && this.shotT <= -0.4) { // süngü zərbəsi (sursat xərcləmir)
        this.shotT = 0.7; this.melee = true;
        if (Math.random() < 0.7) this.target.hit(55 * (0.8 + Math.random() * 0.4), this.pos, "bayonet");
      } else if (!bay && d <= w.range && !blocked && (this.peek || (!this.post && !this.cover)) && this.gun.fire()) {
        this.shotT = 0.7; this.melee = false;
        const hit = Math.random() < hitChance(w, d) * (this.target.evade ?? 1);
        if (!hit) this.target.shotAt?.(this.pos);
        if (hit) this.target.hit(w.dmg * (0.8 + Math.random() * 0.4), this.pos);
        if (!w.melee) ctx.onShot(this.pos.add(new Vector3(0, 1.5, 0)), this.target.pos.add(new Vector3(0, 1.2, 0)), hit, w.id);
      }
    } else if (this.ally) {
      this.freeCover(); if (!this.post) this.stance = "stand";
      if (ctx.order === "attack" && this.alert && Math.hypot(this.alert.x - this.pos.x, this.alert.z - this.pos.z) < 6) this.alert = null;
      if (ctx.order === "attack" && !this.alert && (this.think > 0.2)) { // növbəti hədəf: ən yaxın canlı düşmən (200 m)
        let bd = 40000; for (const f of ctx.foes) { if (!f.alive) continue; const d = (f.pos.x - this.pos.x) ** 2 + (f.pos.z - this.pos.z) ** 2; if (d < bd) { bd = d; this.alert = f.pos.clone(); } }
      }
      goal = this.hold ? this.hold : ctx.order === "follow" ? this.slotPos(ctx) : this.squadGoal ?? this.alert;
      const far = goal ? Vector3.Distance(goal, this.pos) : 0;
      speed = this.type.speed * (far > 40 ? 2 : far > 10 ? 1.3 : 0.7); // geri qalanda tələsir
    } else if (this.squadGoal || this.alert) { // düşmən qrupu öz zolağında irəliləyir (və ya həyəcan nöqtəsinə gedir)
      goal = this.squadGoal ?? this.alert; speed = this.type.speed * 1.2;
      if (this.alert && Math.hypot(this.pos.x - this.alert.x, this.pos.z - this.alert.z) < 3) this.alert = null;
      if (goal && goal === this.squadGoal && Math.hypot(this.pos.x - goal.x, this.pos.z - goal.z) < 2) goal = null;
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
      const mv = this.moved > 0.004;
      const s: AnimState = this.stance === "prone" && !mv ? "prone" : this.stance === "crouch" ? (mv ? "crouchWalk" : "crouch")
        : this.shotT > 0 ? (w.melee || this.melee ? "attack" : "shoot") : mv ? (speed > this.type.speed ? "run" : (this.fireT > 0 && this.target ? "crouchWalk" : "walk")) : "idle";
      if (s !== this.want) { this.want = s; this.wantT = 0; } else this.wantT += dt;
      if (this.near && (this.wantT > 0.3 || s === "attack" || s === "shoot" || s === "prone" || s === "crouch")) this.setAnim(s);
    }
    else if (goal && !this.post) this.mesh.position.y += Math.abs(Math.sin((this.bob += dt * speed * 2.2))) * 0.08; // addım
  }

  /** dəstədəki yeri: liderin ətrafında halqalar (12 nəfərlik) */
  private slotPos(ctx: Ctx) {
    const ring = Math.floor(ctx.slot / 12), ang = ((ctx.slot % 12) / 12) * Math.PI * 2 + ring * 0.3, rr = 4 + ring * 2.5;
    return ctx.leader.add(new Vector3(Math.cos(ang) * rr, 0, Math.sin(ang) * rr));
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
