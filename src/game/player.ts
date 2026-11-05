// Oyunçu: oni maskalı samuray. Üçüncü şəxs kamera (çiyin üstü), sağ klik — nişan/optika, 5 silah, saat formaları.
import { Color3, FreeCamera, Mesh, Ray, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { FORMS, WEAPONS } from "./data";
import { Gun, HALF, heightAt, Watch, type Grid } from "./logic";
import { unitModel, weaponModel } from "./kit";
import type { Target } from "./units";

export class Player implements Target {
  pos = new Vector3(0, 0, 14); yaw = 0; pitch = 0.12; hp = 200; maxHp = 200;
  guns: Gun[]; cur = 0; crouch = false; watch = new Watch(FORMS); formIdx = 0; aiming = false;
  camera: FreeCamera; mesh: Mesh; ally = true; private gunMeshes: Mesh[];
  private keys = new Set<string>(); private mat: StandardMaterial; shooting = false;
  lastNoise = 0; // son atəşin səs radiusu (düşmənlər eşidir)

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
    this.camera = new FreeCamera("cam", new Vector3(0, 5, 0), scene);
    this.camera.minZ = 0.3; this.camera.maxZ = 2400; this.camera.fov = 1.0;

    addEventListener("keydown", (e) => this.key(e, true));
    addEventListener("keyup", (e) => this.key(e, false));
    canvas.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      const k = 0.0025 * this.camera.fov; // nişanda həssaslıq azalır
      this.yaw += e.movementX * k;
      this.pitch = Math.max(-0.7, Math.min(0.9, this.pitch + e.movementY * k));
    });
    canvas.addEventListener("mousedown", (e) => { if (e.button === 0) this.shooting = true; if (e.button === 2) this.aiming = true; });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.shooting = false; if (e.button === 2) this.aiming = false; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => { this.cur = (this.cur + (e.deltaY > 0 ? 1 : this.guns.length - 1)) % this.guns.length; });
  }

  get alive() { return this.hp > 0; }
  get gun() { return this.guns[this.cur]; }
  /** HUD üçün: 0 adi, 1 nişan, 2 snayper optikası */
  get scope(): 0 | 1 | 2 { return !this.aiming || this.watch.active ? 0 : this.gun.w.id === "sniper" ? 2 : 1; }
  hit(dmg: number) { this.hp = Math.max(0, this.hp - dmg * (this.watch.active?.id === "qaya" ? 0.25 : 1)); }

  private key(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    down ? this.keys.add(k) : this.keys.delete(k);
    if (!down) return;
    if (k === "KeyC") this.crouch = !this.crouch;
    if (k === "KeyR") this.gun.reload();
    if (k.startsWith("Digit")) { const i = +k.slice(5) - 1; if (i >= 0 && i < this.guns.length) this.cur = i; }
    if (k === "KeyQ") this.formIdx = (this.formIdx + 1) % FORMS.length;
    if (k === "KeyE") this.watch.active ? this.watch.end() : this.watch.transform(this.formIdx);
  }
  pressed(code: string) { return this.keys.has(code); }

  update(dt: number, grid: Grid, units: Target[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
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
    if (fw || st) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), n = Math.hypot(fw, st);
      this.pos.x += ((s * fw + c * st) / n) * speed * dt;
      this.pos.z += ((c * fw - s * st) / n) * speed * dt;
    }
    for (const o of grid.near(this.pos.x, this.pos.z)) { // maneələrdən keçmə
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.6;
      if (d < r && d > 1e-4) { this.pos.x = o.x + (dx / d) * r; this.pos.z = o.z + (dz / d) * r; }
    }
    const lim = HALF - 30;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    // görünüş
    const sc = f?.id === "qaya" ? 1.5 : this.crouch ? 0.75 : 1, scope = this.scope;
    this.mesh.scaling.setAll(sc);
    this.mesh.position.copyFrom(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mesh.isVisible = scope !== 2;
    this.gunMeshes.forEach((g, i) => (g.isVisible = i === this.cur && !f && scope !== 2));
    this.mat.diffuseColor = f ? Color3.FromHexString(f.color) : Color3.White();
    // kamera: çiyin üstü; nişanda yaxın; optikada gözdən
    const fov = scope === 2 ? 0.22 : scope === 1 ? 0.62 : 1.0;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 12);
    const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let cam: Vector3;
    if (scope === 2) cam = this.pos.add(new Vector3(0, 1.75 * sc, 0)).add(fwd.scale(0.4));
    else {
      const back = scope === 1 ? 2.4 : 5.5, side = scope === 1 ? 0.75 : 1.1;
      cam = this.pos.add(fwd.scale(-back)).add(right.scale(side)).add(new Vector3(0, (scope === 1 ? 1.9 : 2.6) + this.pitch * (scope === 1 ? 1.5 : 4), 0));
      cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.8);
    }
    this.camera.position.copyFrom(cam);
    const look = new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.setTarget(cam.add(look.scale(30)));
    this.lastNoise = 0;
    if (this.shooting && document.pointerLockElement === this.canvas) this.fire(units, onShot);
  }

  private fire(units: Target[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    const f = this.watch.active, from = this.pos.add(new Vector3(0, 1.5, 0));
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
    if (!g.fire()) return;
    // səpələnmə: nişanda az, əyilib nişanda ən az; snayper nişansız pis vurur
    let spread = g.w.spread * (this.aiming ? (this.crouch ? 0.15 : 0.4) : g.w.id === "sniper" ? 25 : 1);
    if (g.w.id === "sniper" && !this.aiming) spread = Math.max(spread, 0.03);
    const { point, unit } = this.aim(g.w.range, spread);
    if (unit && !unit.ally) unit.hit(g.w.dmg);
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
