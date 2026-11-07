// Gecə/gündüz və hava: günəş/ay işığı, ulduzlar, ay diski (orta keyfiyyətdə ay şüaları), vadi dumanı, yağış.
import { Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, ParticleSystem, Scene, ShadowGenerator, StandardMaterial, Texture, Vector3, VolumetricLightScatteringPostProcess, type Camera } from "@babylonjs/core";
import { mix, sunAt, weatherParams, WEATHERS, type WeatherT } from "./logic";

const SKY_DAY = [0.53, 0.72, 0.92], SKY_DUSK = [0.85, 0.45, 0.3], SKY_NIGHT = [0.05, 0.08, 0.16];
const FOG_NIGHT = [0.1, 0.13, 0.2];

function dots(scene: Scene, n: number, size: number) { // ulduz toxuması
  const t = new DynamicTexture("stars", { width: size, height: size / 2 }, scene, false), c = t.getContext();
  c.fillStyle = "#000"; c.fillRect(0, 0, size, size / 2);
  for (let i = 0; i < n; i++) {
    const b = 140 + Math.random() * 115;
    c.fillStyle = `rgb(${b},${b},${b + 10})`; c.fillRect(Math.random() * size, Math.random() * size * 0.22, Math.random() < 0.1 ? 2 : 1, Math.random() < 0.1 ? 2 : 1);
  }
  t.update();
  return t;
}
function radial(scene: Scene, name: string, size: number, stops: [number, string][], spots = false) {
  const t = new DynamicTexture(name, size, scene, false), c = t.getContext() as CanvasRenderingContext2D, h = size / 2;
  const g = c.createRadialGradient(h, h, 0, h, h, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  if (spots) { c.fillStyle = "rgba(170,178,196,0.4)"; for (const [x, y, r] of [[110, 110, 14], [150, 135, 10], [125, 155, 8], [140, 100, 6]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
  t.hasAlpha = true; t.update();
  return t;
}

export class Sky {
  hour = 9;
  speed = 1 / 120; // 1 oyun saatı = 2 real dəqiqə
  weather: WeatherT = "aydın";
  /** true — hava dəyişmir (məs. sübh səhnəsi) */
  fixedWeather = false;
  private sun: DirectionalLight;
  private amb: HemisphericLight;
  private rain: ParticleSystem;
  private mist?: ParticleSystem;
  private domeMat: StandardMaterial; private moon: Mesh;
  shadows?: ShadowGenerator;
  private nextWeather = 240;

  constructor(private scene: Scene, camera: Camera, quality: "low" | "mid", startHour = 9) {
    this.hour = startHour;
    this.amb = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene);
    this.sun.position = new Vector3(100, 150, 60);
    scene.fogMode = Scene.FOGMODE_EXP2;
    // səma günbəzi + ulduzlar
    const dome = MeshBuilder.CreateSphere("dome", { diameter: 4000, segments: 8, sideOrientation: Mesh.BACKSIDE }, scene);
    this.domeMat = new StandardMaterial("domeMat", scene);
    this.domeMat.disableLighting = true; this.domeMat.fogEnabled = false;
    this.domeMat.emissiveTexture = dots(scene, quality === "mid" ? 1400 : 800, 2048);
    dome.material = this.domeMat; dome.isPickable = false; dome.infiniteDistance = true;
    // ay
    this.moon = MeshBuilder.CreatePlane("moonDisc", { size: 150 }, scene);
    const mm = new StandardMaterial("moonMat", scene);
    mm.disableLighting = true; mm.fogEnabled = false;
    mm.emissiveTexture = radial(scene, "moon", 256, [[0, "rgba(255,255,250,1)"], [0.36, "rgba(235,240,255,1)"], [0.4, "rgba(170,190,230,0.35)"], [1, "rgba(120,150,220,0)"]], true);
    mm.opacityTexture = mm.emissiveTexture;
    this.moon.material = mm; this.moon.billboardMode = Mesh.BILLBOARDMODE_ALL; this.moon.isPickable = false; this.moon.infiniteDistance = true;
    if (quality === "mid") { // ay şüaları + kölgə — yalnız orta keyfiyyət
      const vls = new VolumetricLightScatteringPostProcess("rays", 0.5, camera, this.moon, 60, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine(), false);
      vls.exposure = 0.12; vls.decay = 0.965; vls.weight = 0.55; vls.density = 0.9;
      this.shadows = new ShadowGenerator(1024, this.sun);
      this.shadows.usePercentageCloserFiltering = true;
    }
    // yağış
    const r = new ParticleSystem("rain", 1500, scene);
    r.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAAICAYAAADTLS5CAAAAEklEQVQIW2P8////fwYGBgYGAD9jA/1z0nC6AAAAAElFTkSuQmCC", scene);
    r.emitter = camera.position;
    r.minEmitBox = new Vector3(-25, 15, -25); r.maxEmitBox = new Vector3(25, 18, 25);
    r.direction1 = new Vector3(-0.5, -30, 0); r.direction2 = new Vector3(0.5, -35, 0);
    r.minSize = 0.08; r.maxSize = 0.14; r.minLifeTime = 0.5; r.maxLifeTime = 0.6; r.emitRate = 0;
    r.color1 = new Color4(0.7, 0.75, 0.85, 0.6); r.color2 = r.color1;
    r.start();
    this.rain = r;
    if (quality === "mid") { // gecə vadidə alçaq duman — böyük, yumşaq hissəciklər
      const m = new ParticleSystem("mist", 70, scene);
      m.particleTexture = radial(scene, "mistTex", 64, [[0, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]]);
      m.emitter = camera.position;
      m.minEmitBox = new Vector3(-160, -6, -160); m.maxEmitBox = new Vector3(160, 2, 160);
      m.direction1 = new Vector3(-0.6, 0, -0.3); m.direction2 = new Vector3(0.6, 0.05, 0.3);
      m.minSize = 40; m.maxSize = 75; m.minLifeTime = 25; m.maxLifeTime = 40; m.emitRate = 3;
      m.color1 = new Color4(0.55, 0.62, 0.78, 0.07); m.color2 = new Color4(0.5, 0.55, 0.7, 0.05); m.colorDead = new Color4(0.5, 0.55, 0.7, 0);
      m.blendMode = ParticleSystem.BLENDMODE_STANDARD; m.preWarmCycles = 200;
      m.start();
      this.mist = m;
    }
    this.apply();
  }

  addShadowCaster(m: Mesh) { this.shadows?.addShadowCaster(m); }

  update(dt: number, fast = false) {
    this.hour = (this.hour + dt * this.speed * (fast ? 30 : 1)) % 24;
    if (!this.fixedWeather && (this.nextWeather -= dt) <= 0) {
      this.weather = Math.random() < 0.5 ? "aydın" : WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
      this.nextWeather = 150 + Math.random() * 200;
    }
    this.apply();
  }

  get isNight() { return sunAt(this.hour).isNight; }
  get fog() { return weatherParams(this.weather).fog; }

  private apply() {
    const s = sunAt(this.hour), w = weatherParams(this.weather), night = 1 - s.day, moonUp = s.elev < 0;
    // gündüz günəş, gecə ay: eyni işıq, rəngi və istiqaməti dəyişir
    const dir = moonUp ? new Vector3(-0.35, -0.55, -0.75) : new Vector3(-Math.cos(s.azim), -Math.max(0.15, s.elev), -0.3);
    this.sun.direction = dir.normalize();
    this.sun.diffuse = moonUp ? new Color3(0.55, 0.66, 1) : new Color3(1, 0.95, 0.85);
    this.sun.intensity = (moonUp ? 2.2 * night : 2.4 * s.day) * w.light; // PBR işığa daha güclü ehtiyac duyur
    this.amb.intensity = (1.0 + 0.3 * s.day) * (0.6 + 0.4 * w.light);
    this.amb.diffuse = Color3.Lerp(new Color3(0.4, 0.5, 0.75), Color3.White(), s.day);
    this.amb.groundColor = Color3.Lerp(new Color3(0.06, 0.07, 0.12), new Color3(0.3, 0.28, 0.25), s.day);
    const dusk = Math.max(0, 1 - Math.abs(s.elev) * 4) * (s.elev > -0.2 ? 1 : 0);
    let sky = mix(SKY_NIGHT, SKY_DAY, s.day);
    sky = mix(sky, SKY_DUSK, dusk * 0.5);
    sky = mix(sky, [0.5, 0.52, 0.55], (1 - w.light) * s.day);
    const fog = mix(sky, FOG_NIGHT, night * 0.8);
    this.scene.clearColor = new Color4(sky[0], sky[1], sky[2], 1);
    this.scene.fogColor = new Color3(fog[0], fog[1], fog[2]);
    this.scene.fogDensity = w.fog * 0.55 * (s.isNight ? 1.3 : 1);
    this.domeMat.emissiveColor = new Color3(sky[0], sky[1], sky[2]);
    this.domeMat.emissiveTexture!.level = night * w.light;
    this.moon.position = this.sun.direction.scale(-1500);
    this.moon.setEnabled(moonUp && w.light > 0.65);
    this.rain.emitRate = w.rain * 1500;
    if (this.mist) this.mist.emitRate = night > 0.5 ? 3 : 0;
  }
}
