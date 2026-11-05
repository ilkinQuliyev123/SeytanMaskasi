// Oyun dövrəsi: səhnə, dünya, səma, oyunçu, dəstə, düşmənlər, HUD, qələbə/məğlubiyyət.
import { Color3, DefaultRenderingPipeline, Engine, GlowLayer, ImageProcessingConfiguration, MeshBuilder, Scene, StandardMaterial, Vector3, type LinesMesh } from "@babylonjs/core";
import { type ArmySetup, type GameMap } from "./data";
import { Player } from "./player";
import { Sky } from "./sky";
import { spawn, type Unit } from "./units";
import { buildWorld } from "./world";
import { createHud, endScreen, pauseMenu } from "../ui/ui";

export type Quality = "low" | "mid";
let lockCanvas: HTMLCanvasElement | null = null;
/** siçan kilidi — brauzer klik tələb edir; xəta oyunu dayandırmasın */
function lockSafe() { const p = lockCanvas?.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); }

export function runGame(engine: Engine, canvas: HTMLCanvasElement, map: GameMap, setup: ArmySetup, quality: Quality, onExit: () => void) {
  lockCanvas = canvas;
  engine.setHardwareScalingLevel(quality === "low" ? 1.6 : 1.1); // aşağı ölçüdə çək — zəif video kart üçün
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const player = new Player(scene, setup.weapons, canvas);
  const sky = new Sky(scene, player.camera, quality);
  const { obstacles } = buildWorld(scene, map.camps);
  scene.freezeMaterials?.();

  // görünüş: kino tonu, bloom, FXAA, vinyet («cool», amma yüngül)
  const pipe = new DefaultRenderingPipeline("fx", true, scene, [player.camera]);
  pipe.fxaaEnabled = true;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipe.imageProcessing.contrast = 1.25; pipe.imageProcessing.exposure = 1.1;
  pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.2;
  pipe.bloomEnabled = quality === "mid"; pipe.bloomThreshold = 0.7; pipe.bloomWeight = 0.35;
  if (quality === "mid") new GlowLayer("glow", scene, { blurKernelSize: 24 }).intensity = 0.6;

  // dəstə və düşmənlər
  const allies: Unit[] = [
    ...spawn(scene, "samurai", setup.samuraiWeapon, setup.samurai, 0, 36, 8),
    ...spawn(scene, "ninja", setup.ninjaWeapon, setup.ninja, 0, 40, 10)];
  const enemies: Unit[] = map.camps.flatMap((c) => spawn(scene, c.unit, "", setup.enemies, c.x, c.z, 14));
  const all = [...allies, ...enemies];
  let order: "follow" | "attack" = "follow";

  // güllə izləri (hovuz — hər atəşdə yeni obyekt yaradılmır)
  const tracerMat = new StandardMaterial("tr", scene);
  tracerMat.emissiveColor = new Color3(1, 0.8, 0.4); tracerMat.disableLighting = true;
  const tracers: { l: LinesMesh; t: number }[] = [];
  const shot = (a: Vector3, b: Vector3) => {
    let tr = tracers.find((x) => x.t <= 0);
    if (!tr) {
      if (tracers.length > 40) return;
      tr = { l: MeshBuilder.CreateLines("t", { points: [a, b], updatable: true }, scene), t: 0 };
      tr.l.color = new Color3(1, 0.85, 0.5); tr.l.isPickable = false; tracers.push(tr);
    } else MeshBuilder.CreateLines("t", { points: [a, b], instance: tr.l });
    tr.t = 0.07; tr.l.isVisible = true;
  };

  const hud = createHud();
  let paused = false, ended = false, hudT = 0, msg = "Dəstəni yığ və düşmən düşərgələrinə basqın et! (F — əmr)", msgT = 6;
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyF" && !paused) {
      order = order === "follow" ? "attack" : "follow";
      for (const a of allies) a.alert = order === "attack" ? nearestCamp(a.pos) : null;
      msg = order === "attack" ? "Dəstə: HÜCUM!" : "Dəstə: məni izlə"; msgT = 2.5;
    }
  };
  const nearestCamp = (p: Vector3) => {
    const alive = map.camps.filter((c) => enemies.some((e) => e.alive && Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 60));
    const c = alive.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    return c ? new Vector3(c.x, 0, c.z) : null;
  };
  addEventListener("keydown", onKey);
  const lockChange = () => {
    if (document.pointerLockElement !== canvas && !ended && !paused) {
      paused = true;
      pauseMenu(() => { paused = false; hudRebuild(); lockSafe(); }, quit);
    }
  };
  document.addEventListener("pointerlockchange", lockChange);
  const clickLock = () => { if (!paused && !ended) lockSafe(); };
  canvas.addEventListener("click", clickLock);
  let hudRef = hud;
  const hudRebuild = () => { hudRef.destroy(); hudRef = createHud(); };

  scene.onBeforeRenderObservable.add(() => {
    if (paused || ended) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    sky.update(dt, player.pressed("KeyT"));
    player.update(dt, obstacles, enemies, shot);
    if (player.lastNoise) for (const e of enemies) // atəş səsi: yaxındakı düşmənlər gəlir
      if (e.alive && !e.target && Vector3.Distance(e.pos, player.pos) < player.lastNoise) e.alert = player.pos.clone();
    const night = sky.isNight, fog = sky.fog;
    const leader = player.pos;
    allies.forEach((u, i) => u.update(dt, { foes: enemies, night, fog, leader, order, obstacles, mates: allies, onShot: shot, slot: i }));
    const foes = [player, ...allies];
    for (const u of enemies) u.update(dt, { foes, night, fog, leader, order, obstacles, mates: enemies, onShot: shot, slot: 0 });
    for (const t of tracers) if ((t.t -= dt) <= 0) t.l.isVisible = false;
    msgT -= dt;
    const left = enemies.filter((e) => e.alive).length;
    if (!left || !player.alive) return finish(!left);
    if ((hudT -= dt) <= 0) {
      hudT = 0.1;
      const g = player.gun, f = player.watch.active;
      hudRef.update({ hp: player.hp, maxHp: player.maxHp, weapon: g.w.name, ammo: g.ammo, mag: g.w.mag, reloading: g.reloading > 0,
        hour: sky.hour, weather: sky.weather, enemiesLeft: left, enemiesTotal: enemies.length, allies: allies.filter((a) => a.alive).length,
        form: f ? { name: f.name, left: player.watch.left, color: f.color } : null,
        cooldowns: player.watch.forms.map((x, i) => ({ name: (i === player.formIdx ? "▶ " : "") + x.name, cd: player.watch.cd[x.id] ?? 0 })),
        fps: engine.getFps(), msg: msgT > 0 ? msg : "" });
    }
  });

  function finish(won: boolean) {
    ended = true;
    document.exitPointerLock();
    endScreen(won, quit);
  }
  function quit() {
    removeEventListener("keydown", onKey);
    document.removeEventListener("pointerlockchange", lockChange);
    canvas.removeEventListener("click", clickLock);
    hudRef.destroy();
    engine.stopRenderLoop();
    scene.dispose();
    onExit();
  }
  void all;
  engine.runRenderLoop(() => scene.render());
  lockSafe();
}
