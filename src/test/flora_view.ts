// ?flora — Blender bitki modellərini gündüz işığında yaxından göstərir (vizual yoxlama üçün).
import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { floraMesh, type FloraName } from "../game/flora";
import { vcMat } from "../game/kit";

export function floraView(engine: Engine) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.7, 0.85, 1);
  const names: FloraName[] = ["pine", "pine_2", "broad", "maple", "oak", "cypress", "bush", "bushDry", "rock", "rock2"];
  const cam = new ArcRotateCamera("c", -Math.PI / 2 - 0.25, 1.25, 52, new Vector3((names.length - 1) * 4.25, 4, 0), scene);
  cam.fov = 0.9;
  new HemisphericLight("h", new Vector3(0, 1, 0), scene).intensity = 0.6;
  const sun = new DirectionalLight("s", new Vector3(-0.5, -1, 0.6), scene); sun.intensity = 1.1;
  const g = MeshBuilder.CreateGround("g", { width: 120, height: 40 }, scene);
  g.position.x = (names.length - 1) * 4.25;
  const gm = new StandardMaterial("gm", scene); gm.diffuseColor = new Color3(0.36, 0.42, 0.25); gm.specularColor = Color3.Black(); g.material = gm;
  const mat = vcMat(scene, "vcTree", 0);
  names.forEach((n, i) => { floraMesh(scene, n, mat).position.x = i * 8.5; });
  engine.runRenderLoop(() => scene.render());
  setTimeout(() => (document.title = "FLORA_OK"), 1500);
}
