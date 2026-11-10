// Oyunçu: oni maskalı samuray. Üçüncü şəxs kamera (çiyin üstü), sağ klik — nişan/optika, 5 silah, saat formaları.
import { Color3, FreeCamera, Mesh, MeshBuilder, Ray, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { FORMS, WEAPONS } from "./data";
import { Gun, HALF, heightAt, Watch, type Grid } from "./logic";
import { unitModel, weaponModel } from "./kit";
import type { Target, Unit } from "./units";
import { formModel, watchModel } from "./forms";
import { hat, type CharLib, HEAD_UP } from "./chars";
import { AnimationGroup, TransformNode } from "@babylonjs/core";
import { Kit, vcMat } from "./kit";
import { inTallGrass } from "./world";
import type { Dragon } from "./dragon";
import type { Moto } from "./moto";

export class Player implements Target {
  pos = new Vector3(0, 0, 14); yaw = 0; pitch = 0.12; hp = 200; maxHp = 200;
  guns: Gun[]; cur = 0; crouch = false; watch = new Watch(FORMS); formIdx = 0; aiming = false;
  camera: FreeCamera; mesh: Mesh; ally = true; private gunMeshes: Mesh[];
  private keys = new Set<string>(); private mat: StandardMaterial; shooting = false;
  lastNoise = 0; // son atəşin səs radiusu (düşmənlər eşidir)
  private rig: TransformNode | null = null; private clips: Partial<Record<string, AnimationGroup>> = {}; private clip = ""; private shotT = 0;
  jumpV = 0; jumpH = 0; recoil = 0; riding: Dragon | null = null; private hand: TransformNode | null = null; private gunBase: Vector3[] = []; private watchBand: Mesh | null = null;
  /** motosiklet üstündədirsə */
  moto: Moto | null = null;
  /** E: oyun minmə/düşməni yoxlayır; true qaytarsa saat çevrilməsi işləmir */
  interact: (() => boolean) | null = null;
  /** oyun meydanının sərhədi (çıxmaq olmur) */
  bounds = { x0: -(HALF - 30), x1: HALF - 30, z0: -(HALF - 30), z1: HALF - 30 }; atBorder = false;
  wheelOpen = false; flyH = 0; private forms: Record<string, Mesh> = {}; private flash: Mesh; private flashT = 0;
  private dome: Mesh; private dial: Mesh; private wasForm = "";

  constructor(private scene: Scene, weapons: string[], private canvas: HTMLCanvasElement) {
    this.guns = weapons.map((w) => new Gun(WEAPONS[w]));
    this.mesh = unitModel(scene, "samurai");
    this.mat = new StandardMaterial("playerMat", scene);
    this.mat.specularColor = new Color3(0.3, 0.3, 0.3); this.mat.specularPower = 32;
    this.mesh.material = this.mat; this.mesh.isPickable = false;
    this.gunMeshes = weapons.map((w) => {
      const g = weaponModel(scene, w);
      g.parent = this.mesh; g.position.set(0.32, 1.28, 0.3); g.isPickable = false;
      return g;
    });
    const w = watchModel(scene); // sol qolda saat
    w.band.parent = this.mesh; w.band.position.set(-0.4, 0.95, 0.12); w.band.rotation.x = 0.15; w.band.isPickable = false; this.dial = w.dial; this.watchBand = w.band;
    const fm = (hex: string, a: number) => { const m = new StandardMaterial("fx" + hex + a, scene); m.emissiveColor = Color3.FromHexString(hex); m.disableLighting = true; m.alpha = a; return m; };
    this.flash = MeshBuilder.CreateSphere("flash", { diameter: 1, segments: 8 }, scene); this.flash.material = fm("#ff2a2a", 0.5); this.flash.isPickable = false; this.flash.setEnabled(false);
    this.dome = MeshBuilder.CreateSphere("dome", { diameter: 9, segments: 12 }, scene); this.dome.material = fm("#4a8cff", 0.18); this.dome.isPickable = false; this.dome.setEnabled(false);
    this.camera = new FreeCamera("cam", new Vector3(0, 5, 0), scene);
    this.camera.minZ = 0.3; this.camera.maxZ = 2400; this.camera.fov = 1.0;

    const o = { signal: this.ac.signal };
    addEventListener("keydown", (e) => this.key(e, true), o);
    addEventListener("keyup", (e) => this.key(e, false), o);
    canvas.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas || this.wheelOpen) return;
      const k = 0.0025 * this.camera.fov; // nişanda həssaslıq azalır
      this.yaw += e.movementX * k;
      this.pitch = Math.max(-0.7, Math.min(0.9, this.pitch + e.movementY * k));
    }, o);
    canvas.addEventListener("mousedown", (e) => { if (e.button === 0) this.shooting = true; if (e.button === 2) this.aiming = true; }, o);
    addEventListener("mouseup", (e) => { if (e.button === 0) this.shooting = false; if (e.button === 2) this.aiming = false; }, o);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), o);
    canvas.addEventListener("wheel", (e) => { this.cur = (this.cur + (e.deltaY > 0 ? 1 : this.guns.length - 1)) % this.guns.length; }, o);
  }

  /** animasiyalı samuray modelinə keç: oni maskalı kabuto başa, silahlar sağ ələ, saat sol qola bağlanır */
  useChar(lib: CharLib, look: { tint: string; head: (k: Kit) => unknown; outfit?: string; glbHead?: string } = { tint: "#2a1416", head: hat.kabuto }) {
    const c = lib.player({ outfit: look.outfit ?? "Male_Ranger", tint: look.tint });
    this.rig = new TransformNode("rig", this.scene);
    c.root.parent = this.rig;
    const attach = (m: Mesh, node: TransformNode, off: Vector3) => { m.parent = null; m.position.copyFrom(node.getAbsolutePosition().add(off)); m.rotation.setAll(0); m.setParent(node); };
    const hm = vcMat(this.scene, "vcArmor", 0.25);
    const helm = lib.glbProp(look.glbHead, hm) ?? (() => { const k = new Kit(this.scene); look.head(k); return k.build("pHelmet", hm); })();
    attach(helm, c.head, new Vector3(0, look.outfit ? HEAD_UP : 0.1, 0));
    for (const g of this.gunMeshes) { g.rotation.setAll(0); attach(g, c.hand, new Vector3(0, 0, 0.05)); this.gunBase.push(g.position.clone()); }
    this.hand = c.hand;
    if (this.watchBand) attach(this.watchBand, this.scene.getTransformNodeByName("P_hand_l") ?? c.hand, new Vector3(0, 0, 0));
    for (const m of c.meshes) m.isPickable = false;
    this.clips = c.clips;
    for (const g of Object.values(this.clips)) { if (!g) continue; g.weight = 0; g.start(true); }
    this.mesh.setEnabled(false);
  }
  /** animasiya qarışığı: hədəf klipin çəkisi 1-ə, qalanları 0-a doğru (yumşaq keçid) */
  private animate(dt: number, name: string) {
    if (!this.rig) return;
    this.clip = name;
    for (const [n, g] of Object.entries(this.clips)) if (g) g.weight += ((n === name ? 1 : 0) - g.weight) * Math.min(1, dt * 10);
  }
  private ac = new AbortController();
  dispose() { this.ac.abort(); this.keys.clear(); }
  /** vurma hissi: son atəş kimisə vurdusa true (HUD işarəsi üçün) */
  hitFlash = 0;
  get alive() { return this.hp > 0; }
  get gun() { return this.guns[this.cur]; }
  /** HUD üçün: 0 adi, 1 nişan, 2 snayper optikası */
  get scope(): 0 | 1 | 2 { return !this.aiming || this.watch.active ? 0 : this.gun.w.id === "sniper" ? 2 : 1; }
  hit(dmg: number) { const f = this.watch.active?.id; this.hp = Math.max(0, this.hp - dmg * (f === "qalxan" ? 0 : f === "qaya" ? 0.25 : 1)); }
  /** düşmənin görmə əmsalı: kölgə demək olar görünmür, kiçik və əyilmiş çətin görünür */
  get stealth() {
    const f = this.watch.active?.id, grass = inTallGrass(this.pos.x, this.pos.z);
    return f === "kolge" ? 0.12 : f === "kicik" ? 0.35 : grass ? (this.crouch ? 0.15 : 0.45) : this.crouch ? 0.6 : 1;
  }
  get formMesh() { const f = this.watch.active; return f ? (this.forms[f.id] ??= Object.assign(formModel(this.scene, f.id), { isPickable: false })) : null; }

  private key(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    down ? this.keys.add(k) : this.keys.delete(k);
    if (!down) return;
    if (k === "KeyC") this.crouch = !this.crouch;
    if (k === "KeyR") this.gun.reload();
    if (k.startsWith("Digit")) { const i = +k.slice(5) - 1; if (i >= 0 && i < this.guns.length) this.cur = i; }
    if (k === "KeyE" && !e.repeat) { if (this.interact?.()) return; if (this.moto || this.riding) return; this.watch.active ? this.watch.end() : this.watch.transform(this.formIdx); }
  }
  pressed(code: string) { return this.keys.has(code); }

  update(dt: number, grid: Grid, units: Target[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    if (this.riding) return this.ride(dt, units, grid);
    if (this.moto) return this.drive(dt, grid, units, onShot);
    for (const g of this.guns) g.update(dt);
    this.watch.update(dt);
    const f = this.watch.active;
    // hərəkət
    const fw = (this.pressed("KeyW") ? 1 : 0) - (this.pressed("KeyS") ? 1 : 0);
    const st = (this.pressed("KeyD") ? 1 : 0) - (this.pressed("KeyA") ? 1 : 0);
    let speed = this.pressed("ShiftLeft") && !this.aiming ? 9 : 5;
    if (this.crouch) speed *= 0.5;
    if (this.aiming) speed *= 0.5;
    if (f?.id === "ildirim") speed *= 3;
    if (f?.id === "qanad") speed *= 1.8;
    // uçuş (Qanad): Space qalx, Ctrl en; forma bitəndə yavaşca enir
    // tullanma (Space): qanad formasında deyilsə
    if (f?.id !== "qanad" && this.pressed("Space") && this.jumpH <= 0 && this.jumpV <= 0) this.jumpV = 7.5;
    if (this.jumpV !== 0 || this.jumpH > 0) { this.jumpH += this.jumpV * dt; this.jumpV -= 22 * dt; if (this.jumpH <= 0) { this.jumpH = 0; this.jumpV = 0; } }
    this.flyH = f?.id === "qanad" ? Math.max(0, Math.min(40, this.flyH + ((this.pressed("Space") ? 1 : 0) - (this.pressed("ControlLeft") ? 1 : 0)) * 8 * dt)) : Math.max(0, this.flyH - 6 * dt);
    if (fw || st) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), n = Math.hypot(fw, st);
      this.pos.x += ((s * fw + c * st) / n) * speed * dt;
      this.pos.z += ((c * fw - s * st) / n) * speed * dt;
    }
    const free = f?.id === "horumcek" || this.flyH > 13; // hörümçək divara dırmaşır, uçan üstündən keçir
    if (!free) for (const o of grid.near(this.pos.x, this.pos.z)) { // maneələrdən keçmə
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.6;
      if (d < r && d > 1e-4) { this.pos.x = o.x + (dx / d) * r; this.pos.z = o.z + (dz / d) * r; }
    }
    const B = this.bounds;
    this.atBorder = this.pos.x < B.x0 || this.pos.x > B.x1 || this.pos.z < B.z0 || this.pos.z > B.z1;
    this.pos.x = Math.max(B.x0, Math.min(B.x1, this.pos.x)); this.pos.z = Math.max(B.z0, Math.min(B.z1, this.pos.z));
    this.pos.y = heightAt(this.pos.x, this.pos.z) + this.flyH + this.jumpH;
    // görünüş
    const sc = f?.id === "qaya" ? 1.5 : f?.id === "kicik" ? 0.4 : this.crouch ? 0.75 : 1, scope = this.scope;
    const attackForm = !!f && ["alov", "qaya", "buz", "horumcek", "maqnit"].includes(f.id);
    if ((f?.id ?? "") !== this.wasForm) { // çevrilmə anı — işıq partlayışı
      this.wasForm = f?.id ?? ""; this.flashT = 0.45;
      (this.flash.material as StandardMaterial).emissiveColor = Color3.FromHexString(f?.color ?? "#ff2a2a");
      for (const m of Object.values(this.forms)) m.isVisible = false;
    }
    const body = this.formMesh ?? this.mesh;
    this.mesh.isVisible = !f && scope !== 2;
    if (this.rig) { // animasiyalı model
      this.rig.setEnabled(!f && scope !== 2);
      this.rig.position.copyFrom(this.pos); this.rig.rotation.set(0, this.yaw, 0);
      const moving = !!(fw || st), g = this.gun;
      this.shotT -= dt;
      this.animate(dt, !this.alive ? "Death01" : this.jumpH > 0 ? "Jump_Loop" : this.crouch ? (moving ? "Crouch_Fwd_Loop" : "Crouch_Idle_Loop")
        : moving ? (speed > 8 ? "Sprint_Loop" : speed > 4 ? "Jog_Fwd_Loop" : "Walk_Loop")
        : g.reloading > 0 ? "Pistol_Reload" : this.shotT > 0 ? "Pistol_Shoot" : this.aiming ? "Pistol_Aim_Neutral" : "Idle_Loop");
    }
    for (const m of [this.mesh, body]) { m.scaling.setAll(sc); m.position.copyFrom(this.pos); m.rotation.y = this.yaw; }
    if (f) body.isVisible = f.id === "kolge" ? Math.random() < 0.15 : scope !== 2; // kölgə titrəyir
    if (f?.id === "qanad") body.position.y += Math.sin(performance.now() / 150) * 0.1;
    this.gunMeshes.forEach((g, i) => {
      g.isVisible = i === this.cur && !attackForm && scope !== 2 && f?.id !== "kolge";
      if (this.hand && !f) { g.parent = this.hand; g.position.copyFrom(this.gunBase[i]); } // animasiyalı əldə
      else { g.parent = body; g.position.set(0.32, f?.id === "kicik" ? 0.8 : 1.28, 0.3); }
    });
    { const gm = this.gunMeshes[this.cur], g = this.gun, t = g.reloading > 0 ? 1 - g.reloading / g.w.reload : 0, k = Math.sin(t * Math.PI);
      this.recoil = Math.max(0, this.recoil - dt * 4);
      gm.rotation.set(-k * 0.7 - this.recoil * 0.6, k * 0.4, k * 0.5); gm.position.z += -this.recoil * 0.08;
      const mag = gm.getChildMeshes()[0]; if (mag) { mag.position.y = -k * 0.35; mag.isVisible = t < 0.45 || t > 0.6; } }
    (this.dial.material as StandardMaterial).emissiveColor = Color3.FromHexString(f ? f.color : (this.watch.cd[FORMS[this.formIdx].id] ?? 0) > 0 ? "#551015" : "#ff1e2a");
    this.flash.setEnabled(this.flashT > 0);
    if (this.flashT > 0) { this.flashT -= dt; this.flash.position.copyFrom(this.pos).y += 1.2; this.flash.scaling.setAll(1 + (0.45 - this.flashT) * 14); }
    this.dome.setEnabled(f?.id === "qalxan"); this.dome.position.copyFrom(this.pos);
    // kamera: çiyin üstü; nişanda yaxın; optikada gözdən
    const fov = scope === 2 ? 0.22 : scope === 1 ? 0.62 : 1.0;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 12);
    const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let cam: Vector3;
    if (scope === 2) cam = this.pos.add(new Vector3(0, 1.75 * sc, 0)).add(fwd.scale(0.4));
    else if (f?.id === "kicik") { cam = this.pos.add(fwd.scale(-2.6)).add(right.scale(0.5)).add(new Vector3(0, 1.2 + this.pitch * 2, 0)); cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.4); }
    else {
      const back = scope === 1 ? 2.4 : 5.5, side = scope === 1 ? 0.75 : 1.1;
      cam = this.pos.add(fwd.scale(-back)).add(right.scale(side)).add(new Vector3(0, (scope === 1 ? 1.9 : 2.6) + this.pitch * (scope === 1 ? 1.5 : 4), 0));
      if (f?.id === "qaya") cam = cam.add(fwd.scale(-2)).add(new Vector3(0, 1, 0));
      cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.8);
      const head = this.pos.add(new Vector3(0, 1.7, 0)), v = cam.subtract(head), len = v.length();
      const hit = this.scene.pickWithRay(new Ray(head, v.scale(1 / len), len), (m) => !!m.metadata?.solid, true);
      if (hit?.hit && hit.pickedPoint) cam = Vector3.Lerp(head, hit.pickedPoint, Math.max(0, (hit.distance - 0.4) / hit.distance));
    }
    this.camera.position.copyFrom(cam);
    const look = new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.setTarget(cam.add(look.scale(30)));
    this.lastNoise = 0;
    if (this.shooting && document.pointerLockElement === this.canvas) this.fire(units, onShot);
  }

  /** əjdaha üstündə: WASD uç, Space/Ctrl qalx/en, Shift sürət, sol klik alov */
  private ride(dt: number, units: Target[], grid: Grid) {
    const d = this.riding!, k = (c: string) => (this.pressed(c) ? 1 : 0);
    d.update(dt, this.pos, units, { fw: k("KeyW") - k("KeyS"), st: k("KeyD") - k("KeyA"), up: k("Space") - k("ControlLeft"), boost: this.pressed("ShiftLeft"),
      yaw: this.yaw, pitch: this.pitch, fire: this.shooting && document.pointerLockElement === this.canvas }, grid);
    this.pos.copyFrom(d.saddle);
    this.rig?.setEnabled(true); this.rig?.position.copyFrom(this.pos.add(new Vector3(0, -0.9, 0))); this.rig?.rotation.set(0, this.yaw, 0);
    this.animate(dt, "Sitting_Idle_Loop");
    for (const g of this.gunMeshes) g.isVisible = false;
    const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const cam = this.pos.add(fwd.scale(-19)).add(new Vector3(0, 7 + this.pitch * 9, 0));
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 1);
    this.camera.position.copyFrom(cam);
    this.camera.setTarget(this.pos.add(new Vector3(Math.sin(this.yaw) * 30, 2 - this.pitch * 20, Math.cos(this.yaw) * 30)));
    this.watch.update(dt); this.lastNoise = 0;
  }

  /** motosiklet: W/S qaz-əyləc, A/D sükan, Shift nitro; siçan — kamera və nişan, sol klik — atəş */
  private drive(dt: number, grid: Grid, units: Target[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    const m = this.moto!, k = (c: string) => (this.pressed(c) ? 1 : 0);
    for (const g of this.guns) g.update(dt);
    this.watch.update(dt);
    m.update(dt, { fw: k("KeyW") - k("KeyS"), st: k("KeyD") - k("KeyA"), boost: this.pressed("ShiftLeft") }, grid);
    this.pos.copyFrom(m.seat); this.flyH = 0; this.jumpH = 0; this.jumpV = 0;
    if (this.rig) {
      this.rig.setEnabled(this.scope !== 2);
      this.rig.position.copyFrom(m.seat.add(new Vector3(0, -0.92, 0)));
      this.rig.rotation.set(m.pitch, m.yaw, m.lean);
      this.shotT -= dt;
      this.animate(dt, this.shotT > 0 ? "Pistol_Shoot" : "Driving_Loop");
    }
    this.mesh.isVisible = false;
    this.gunMeshes.forEach((g, i) => { g.isVisible = i === this.cur && this.scope !== 2; if (this.hand) { g.parent = this.hand; g.position.copyFrom(this.gunBase[i]); } });
    this.recoil = Math.max(0, this.recoil - dt * 4);
    // kamera: motosikletin arxasında, siçanla ətrafa baxmaq olur; sürətdə bir az geri çəkilir
    const scope = this.scope, fov = scope === 2 ? 0.22 : scope === 1 ? 0.62 : 1.0 + Math.min(0.15, m.kmh / 600);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8);
    const look = new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const back = scope === 1 ? 3 : 5.5 + Math.min(2, m.kmh / 50), shake = m.bump > 0 ? (Math.random() - 0.5) * m.bump * 0.6 : 0;
    const cam = this.pos.add(new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).scale(-back)).add(new Vector3(shake, 1.8 + this.pitch * 3.5, 0));
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.6);
    this.camera.position.copyFrom(cam);
    this.camera.setTarget(cam.add(look.scale(30)));
    this.lastNoise = Math.abs(m.speed) > 2 ? 25 : 8; // mühərrik səsi düşmənləri cəlb edir
    if (this.shooting && document.pointerLockElement === this.canvas) this.fire(units, onShot);
  }

  private fire(units: Target[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    const f = this.watch.active, from = this.pos.add(new Vector3(0, 1.5, 0));
    if (f?.id === "buz" || f?.id === "horumcek" || f?.id === "maqnit") { // dondurma / tor / maqnit
      if (this.gun.cool > 0) return;
      const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (f.id === "horumcek") { const { point, unit } = this.aim(60); if (unit && !unit.ally && "stun" in unit) (unit as Unit).stun = 7; onShot(from, point, !!unit); this.gun.cool = 0.7; }
      else for (const u of units) {
        if (u.ally || !u.alive || !("stun" in u)) continue;
        const d = u.pos.subtract(this.pos), dist = d.length();
        if (f.id === "buz" && dist < 26 && Vector3.Dot(d.normalize(), fwd) > 0.88) { (u as Unit).stun = 5; u.hit(15); onShot(from, u.pos.add(new Vector3(0, 1, 0)), true); }
        if (f.id === "maqnit" && dist < 24) (u as Unit).disarm();
      }
      if (f.id !== "horumcek") this.gun.cool = f.id === "buz" ? 0.9 : 2;
      this.lastNoise = 10;
      return;
    }
    if (f?.id === "alov" || f?.id === "qaya") { // forma hücumu
      if (this.gun.cool > 0) return;
      this.gun.cool = f.id === "alov" ? 0.6 : 1.2;
      const center = f.id === "alov" ? this.aim(80).point : this.pos;
      const r = f.id === "alov" ? 4 : 7, dmg = f.id === "alov" ? 90 : 70;
      for (const u of units) if (!u.ally && u.alive && Vector3.Distance(u.pos, center) < r + 1.5) u.hit(dmg);
      onShot(from, center, true);
      this.lastNoise = 40;
      return;
    }
    const g = this.gun;
    if (g.w.id === "saat") { if (!this.watch.active) this.watch.transform(this.formIdx); return; } // saat — seçilmiş bədheybətə çevril
    if (!g.fire()) return;
    this.shotT = 0.35; this.recoil = g.w.id === "sniper" ? 0.5 : g.w.id === "pbow" ? 0.15 : 0.18;
    // səpələnmə: nişanda az, əyilib nişanda ən az; snayper nişansız pis vurur
    let spread = g.w.spread * (this.aiming ? (this.crouch ? 0.15 : 0.4) : g.w.id === "sniper" ? 25 : 1);
    if (g.w.id === "sniper" && !this.aiming) spread = Math.max(spread, 0.03);
    const { point, unit } = this.aim(g.w.range, spread);
    if (unit && !unit.ally) { unit.hit(g.w.dmg, this.pos); this.hitFlash = 0.15; }
    onShot(from, point, !!unit);
    this.lastNoise = g.w.noise;
  }

  /** ekranın mərkəzindən şüa: döyüşçüyə, divara/evə, yoxsa yerə dəyir */
  private aim(range: number, spread = 0): { point: Vector3; unit: Target | null } {
    const dir = this.camera.getForwardRay(1).direction.clone();
    dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2; dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const len = range + 8, ray = new Ray(this.camera.position, dir, len);
    const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && m.isEnabled() && (m.metadata?.unit || m.metadata?.solid));
    let gd = len; // yer: sadə şüa addımlama (böyük relyefi seçməkdən çox ucuz)
    for (let t = 1; t < len; t += 1.5) {
      const p = ray.origin.add(dir.scale(t));
      if (p.y < heightAt(p.x, p.z)) { gd = t; break; }
    }
    if (pick?.hit && pick.distance < gd) return { point: pick.pickedPoint!, unit: (pick.pickedMesh?.metadata?.unit as Target) ?? null };
    return { point: ray.origin.add(dir.scale(gd)), unit: null };
  }
}
