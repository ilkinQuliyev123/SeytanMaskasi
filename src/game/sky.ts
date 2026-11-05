// Gecə/gündüz və hava: günəş, işıq, səma rəngi, duman, yağış.
import { Color3, Color4, DirectionalLight, HemisphericLight, ParticleSystem, Scene, ShadowGenerator, Texture, Vector3, type Camera, type Mesh } from "@babylonjs/core";
import { mix, sunAt, weatherParams, WEATHERS, type WeatherT } from "./logic";

const SKY_DAY = [0.53, 0.72, 0.92], SKY_DUSK = [0.85, 0.45, 0.3], SKY_NIGHT = [0.02, 0.03, 0.08];

export class Sky {
  hour = 9;
  speed = 1 / 30; // 1 oyun saatı = 30 real saniyə
  weather: WeatherT = "aydın";
  private sun: DirectionalLight;
  private amb: HemisphericLight;
  private rain: ParticleSystem;
  shadows?: ShadowGenerator;
  private nextWeather = 120;

  constructor(private scene: Scene, camera: Camera, quality: "low" | "mid") {
    this.amb = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene);
    this.sun.position = new Vector3(100, 150, 60);
    if (quality === "mid") {
      this.shadows = new ShadowGenerator(1024, this.sun);
      this.shadows.usePercentageCloserFiltering = true;
    }
    scene.fogMode = Scene.FOGMODE_EXP2;
    // yağış: kameranın üstündə kiçik hissəciklər
    const r = new ParticleSystem("rain", 1500, scene);
    r.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAAICAYAAADTLS5CAAAAEklEQVQIW2P8////fwYGBgYGAD9jA/1z0nC6AAAAAElFTkSuQmCC", scene);
    r.emitter = camera.position;
    r.minEmitBox = new Vector3(-25, 15, -25); r.maxEmitBox = new Vector3(25, 18, 25);
    r.direction1 = new Vector3(-0.5, -30, 0); r.direction2 = new Vector3(0.5, -35, 0);
    r.minSize = 0.08; r.maxSize = 0.14; r.minLifeTime = 0.5; r.maxLifeTime = 0.6; r.emitRate = 0;
    r.color1 = new Color4(0.7, 0.75, 0.85, 0.6); r.color2 = r.color1;
    r.start();
    this.rain = r;
    this.apply();
  }

  addShadowCaster(m: Mesh) { this.shadows?.addShadowCaster(m); }

  update(dt: number, fast = false) {
    this.hour = (this.hour + dt * this.speed * (fast ? 20 : 1)) % 24;
    if ((this.nextWeather -= dt) <= 0) { // hava ara-sıra dəyişir
      this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
      this.nextWeather = 90 + Math.random() * 120;
    }
    this.apply();
  }

  get isNight() { return sunAt(this.hour).isNight; }
  get fog() { return weatherParams(this.weather).fog; }

  private apply() {
    const s = sunAt(this.hour), w = weatherParams(this.weather);
    this.sun.direction = new Vector3(-Math.cos(s.azim), -Math.max(0.15, s.elev), -0.3).normalize();
    this.sun.intensity = 1.1 * s.day * w.light;
    this.amb.intensity = (0.12 + 0.55 * s.day) * (0.6 + 0.4 * w.light);
    const dusk = Math.max(0, 1 - Math.abs(s.elev) * 4) * (s.elev > -0.2 ? 1 : 0);
    let sky = mix(SKY_NIGHT, SKY_DAY, s.day);
    sky = mix(sky, SKY_DUSK, dusk * 0.5);
    sky = mix(sky, [0.5, 0.52, 0.55], 1 - w.light); // bulud/yağış boz edir
    this.scene.clearColor = new Color4(sky[0], sky[1], sky[2], 1);
    this.scene.fogColor = new Color3(sky[0], sky[1], sky[2]);
    this.scene.fogDensity = w.fog * (s.isNight ? 1.5 : 1);
    this.rain.emitRate = w.rain * 1500;
  }
}
