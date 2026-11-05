// Oyunçu: üçüncü şəxs kamera (çiyin üstü), WASD, qaçış, əyilmə, atəş, silah dəyişmə, saat formaları.
import { Color3, FreeCamera, Mesh, MeshBuilder, Ray, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { FORMS, WEAPONS } from "./data";
import { Gun, heightAt, Watch } from "./logic";
import type { Target, Unit } from "./units";

export class Player implements Target {
  pos = new Vector3(0, 0, 30); yaw = Math.PI; pitch = 0.15; hp = 200; maxHp = 200;
  guns: Gun[]; cur = 0; crouch = false; watch = new Watch(FORMS); formIdx = 0;
  camera: FreeCamera; mesh: Mesh; ally = true;
  private keys = new Set<string>(); private mat: StandardMaterial; shooting = false;
  lastNoise = 0; // son atəşin səs radiusu (düşmənlər eşidir)

  constructor(private scene: Scene, weapons: string[], private canvas: HTMLCanvasElement) {
    this.guns = weapons.map((w) => new Gun(WEAPONS[w]));
    const body = MeshBuilder.CreateCylinder("pb", { height: 1.3, diameterTop: 0.75, diameterBottom: 0.6, tessellation: 8 }, scene);
    body.position.y = 0.95;
    const head = MeshBuilder.CreateSphere("ph", { diameter: 0.55, segments: 6 }, scene);
    head.position.y = 1.85;
    const mask = MeshBuilder.CreateBox("mask", { width: 0.42, height: 0.3, depth: 0.12 }, scene);
    mask.position.set(0, 1.88, 0.25);
    const red = new StandardMaterial("maskM", scene);
    red.diffuseColor = new Color3(0.75, 0.05, 0.08); red.emissiveColor = new Color3(0.3, 0, 0);
    mask.material = red;
    this.mat = new StandardMaterial("pm", scene);
    this.mat.diffuseColor = new Color3(0.08, 0.08, 0.1); this.mat.specularColor = Color3.Black();
    body.material = this.mat; head.material = this.mat;
    this.mesh = Mesh.MergeMeshes([body, head, mask], true, true, undefined, false, true)!;
    this.mesh.isPickable = false;
    this.camera = new FreeCamera("cam", new Vector3(0, 5, 20), scene);
    this.camera.minZ = 0.3; this.camera.maxZ = 600; this.camera.fov = 1.0;

    addEventListener("keydown", (e) => this.key(e, true));
    addEventListener("keyup", (e) => this.key(e, false));
    canvas.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw += e.movementX * 0.0025;
      this.pitch = Math.max(-0.6, Math.min(0.9, this.pitch + e.movementY * 0.0025));
    });
    canvas.addEventListener("mousedown", (e) => { if (e.button === 0) this.shooting = true; });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.shooting = false; });
    canvas.addEventListener("wheel", (e) => { this.cur = (this.cur + (e.deltaY > 0 ? 1 : this.guns.length - 1)) % this.guns.length; });
  }

  get alive() { return this.hp > 0; }
  get gun() { return this.guns[this.cur]; }
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

  update(dt: number, obstacles: { x: number; z: number; r: number }[], units: Unit[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    for (const g of this.guns) g.update(dt);
    this.watch.update(dt);
    const f = this.watch.active;
    // hərəkət
    const fw = (this.pressed("KeyW") ? 1 : 0) - (this.pressed("KeyS") ? 1 : 0);
    const st = (this.pressed("KeyD") ? 1 : 0) - (this.pressed("KeyA") ? 1 : 0);
    let speed = this.pressed("ShiftLeft") ? 8.5 : 5;
    if (this.crouch) speed *= 0.5;
    if (f?.id === "ildirim") speed *= 3;
    if (fw || st) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), n = Math.hypot(fw, st);
      this.pos.x += ((s * fw + c * st) / n) * speed * dt;
      this.pos.z += ((c * fw - s * st) / n) * speed * dt;
    }
    for (const o of obstacles) { // maneələrdən keçmə
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz);
      if (d < o.r + 0.6) { this.pos.x = o.x + (dx / d) * (o.r + 0.6); this.pos.z = o.z + (dz / d) * (o.r + 0.6); }
    }
    this.pos.x = Math.max(-200, Math.min(200, this.pos.x)); this.pos.z = Math.max(-200, Math.min(200, this.pos.z));
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    // görünüş
    const sc = f?.id === "qaya" ? 1.5 : this.crouch ? 0.75 : 1;
    this.mesh.scaling.setAll(sc);
    this.mesh.position.copyFrom(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mat.diffuseColor = f ? Color3.FromHexString(f.color) : new Color3(0.08, 0.08, 0.1);
    // kamera: çiyin üstündən
    const back = new Vector3(-Math.sin(this.yaw) * 5.5, 2.6 + this.pitch * 4, -Math.cos(this.yaw) * 5.5);
    const right = new Vector3(Math.cos(this.yaw) * 1.1, 0, -Math.sin(this.yaw) * 1.1);
    const cam = this.pos.add(back).add(right);
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.8);
    this.camera.position.copyFrom(cam);
    this.camera.setTarget(this.pos.add(right).add(new Vector3(Math.sin(this.yaw) * 20, 1.8 - this.pitch * 12, Math.cos(this.yaw) * 20)));
    this.lastNoise = 0;
    if (this.shooting && document.pointerLockElement === this.canvas) this.fire(units, onShot);
  }

  private fire(units: Unit[], onShot: (a: Vector3, b: Vector3, hit: boolean) => void) {
    const f = this.watch.active;
    if (f?.id === "alov" || f?.id === "qaya") { // forma hücumu
      if (this.gun.cool > 0) return;
      this.gun.cool = f.id === "alov" ? 0.6 : 1.2;
      const center = f.id === "alov" ? this.aim(80).point : this.pos;
      const r = f.id === "alov" ? 4 : 7, dmg = f.id === "alov" ? 90 : 70;
      for (const u of units) if (!u.ally && u.alive && Vector3.Distance(u.pos, center) < r) u.hit(dmg);
      onShot(this.pos.add(new Vector3(0, 1.6, 0)), center, true);
      this.lastNoise = 40;
      return;
    }
    const g = this.gun;
    if (!g.fire()) return;
    const { point, unit } = this.aim(g.w.range, g.w.spread);
    if (unit && !unit.ally) unit.hit(g.w.dmg);
    onShot(this.pos.add(new Vector3(0, 1.6, 0)), point, !!unit);
    this.lastNoise = g.w.noise;
  }

  /** ekranın mərkəzindən şüa: nəyə dəyir */
  private aim(range: number, spread = 0): { point: Vector3; unit: Unit | null } {
    const dir = this.camera.getForwardRay(1).direction.clone();
    dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2;
    const ray = new Ray(this.camera.position, dir.normalize(), range + 8);
    const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && (m.metadata?.unit || m.name === "ground"));
    const unit = (pick?.pickedMesh?.metadata?.unit as Unit) ?? null;
    return { point: pick?.pickedPoint ?? ray.origin.add(ray.direction.scale(range)), unit };
  }
}
