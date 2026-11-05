// Dünya: 4 dağ arasında vadi, meşə, yapon sarayı, düşmən düşərgələri. Hamısı low-poly (yüngül).
import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3, VertexBuffer } from "@babylonjs/core";
import { heightAt } from "./logic";
import type { Camp } from "./data";

export const SIZE = 420;

function mat(scene: Scene, hex: string, name = hex) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = Color3.Black();
  return m;
}

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function buildWorld(scene: Scene, camps: Camp[]) {
  // relyef
  const ground = MeshBuilder.CreateGround("ground", { width: SIZE, height: SIZE, subdivisions: 140, updatable: true }, scene);
  const pos = ground.getVerticesData(VertexBuffer.PositionKind)!;
  const col: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const h = heightAt(pos[i], pos[i + 2]);
    pos[i + 1] = h;
    const t = Math.min(1, h / 55); // ot → qaya → qar
    const c = h > 52 ? [0.92, 0.93, 0.95] : [0.3 + 0.3 * t, 0.45 - 0.05 * t, 0.22 + 0.2 * t];
    col.push(c[0], c[1], c[2], 1);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, pos);
  ground.setVerticesData(VertexBuffer.ColorKind, col);
  ground.createNormals(false);
  const gm = mat(scene, "#ffffff", "groundMat");
  ground.material = gm;
  ground.receiveShadows = true;
  ground.freezeWorldMatrix();

  // meşə: bir ağac, yüzlərlə nüsxə (thin instances — çox ucuz)
  const trunk = MeshBuilder.CreateCylinder("trunk", { height: 3, diameter: 0.5, tessellation: 5 }, scene);
  trunk.position.y = 1.5;
  trunk.material = mat(scene, "#5a3d22");
  const crown = MeshBuilder.CreateCylinder("crown", { height: 6, diameterTop: 0, diameterBottom: 3.6, tessellation: 6 }, scene);
  crown.position.y = 5.5;
  crown.material = mat(scene, "#1f5130");
  const tree = Mesh.MergeMeshes([trunk, crown], true, true, undefined, false, true)!;
  const r = rng(7);
  const mats: number[] = [];
  for (let n = 0; n < 1400 && mats.length < 900 * 16; n++) {
    const x = (r() - 0.5) * SIZE * 0.95, z = (r() - 0.5) * SIZE * 0.95;
    const d = Math.hypot(x, z), h = heightAt(x, z);
    if (d < 60 || h > 45 || camps.some((c) => Math.hypot(x - c.x, z - c.z) < 22)) continue;
    const s = 0.7 + r() * 0.7;
    Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Vector3.Up(), r() * 6), new Vector3(x, h, z)).copyToArray(mats, mats.length);
  }
  tree.thinInstanceSetBuffer("matrix", new Float32Array(mats), 16, true);
  const obstacles: { x: number; z: number; r: number }[] = [];

  buildPalace(scene, obstacles);
  for (const c of camps) buildCamp(scene, c, obstacles);
  return { ground, obstacles };
}

// yapon sarayı: daş platforma, 3 mərtəbəli pagoda, divar və darvaza
function buildPalace(scene: Scene, obs: { x: number; z: number; r: number }[]) {
  const wood = mat(scene, "#7a2418"), roof = mat(scene, "#2b2d33"), stone = mat(scene, "#9a958a"), wall = mat(scene, "#e8e2d2");
  const base = MeshBuilder.CreateBox("palaceBase", { width: 26, depth: 26, height: 2 }, scene);
  base.position.y = 1; base.material = stone;
  for (let i = 0; i < 3; i++) {
    const w = 18 - i * 4.5, y = 2 + i * 6;
    const body = MeshBuilder.CreateBox("pal" + i, { width: w, depth: w, height: 4.5 }, scene);
    body.position.y = y + 2.25; body.material = i ? wood : wall;
    const rf = MeshBuilder.CreateCylinder("roof" + i, { height: 1.8, diameterTop: w * 0.7, diameterBottom: w * 1.75, tessellation: 4 }, scene);
    rf.rotation.y = Math.PI / 4; rf.position.y = y + 5.4; rf.material = roof;
  }
  const spire = MeshBuilder.CreateCylinder("spire", { height: 4, diameterTop: 0, diameterBottom: 1, tessellation: 6 }, scene);
  spire.position.y = 22; spire.material = roof;
  obs.push({ x: 0, z: 0, r: 13 });
  // divar (cənubda darvaza boşluğu)
  const L = 44;
  for (const [x, z, w, d] of [[0, -L / 2, L, 1.2], [-L / 2, 0, 1.2, L], [L / 2, 0, 1.2, L], [-13, L / 2, 18, 1.2], [13, L / 2, 18, 1.2]]) {
    const b = MeshBuilder.CreateBox("wall", { width: w, depth: d, height: 3.5 }, scene);
    b.position.set(x, 1.75, z); b.material = wall;
    const cap = MeshBuilder.CreateBox("wallcap", { width: w + 0.8, depth: d + 0.8, height: 0.5 }, scene);
    cap.position.set(x, 3.7, z); cap.material = roof;
  }
  // torii darvazası
  for (const x of [-4, 4]) {
    const p = MeshBuilder.CreateCylinder("torii", { height: 7, diameter: 0.7, tessellation: 8 }, scene);
    p.position.set(x, 3.5, L / 2 + 6); p.material = wood;
  }
  const beam = MeshBuilder.CreateBox("toriiBeam", { width: 11, height: 0.7, depth: 0.8 }, scene);
  beam.position.set(0, 7, L / 2 + 6); beam.material = wood;
}

function buildCamp(scene: Scene, c: Camp, obs: { x: number; z: number; r: number }[]) {
  const tent = mat(scene, c.unit === "mongol" ? "#d8c9a3" : "#c9c2b0", "tent" + c.id);
  const flag = mat(scene, c.unit === "mongol" ? "#3a5fa0" : "#b3261e", "flag" + c.id);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, x = c.x + Math.cos(a) * 12, z = c.z + Math.sin(a) * 12;
    const t = c.unit === "mongol"
      ? MeshBuilder.CreateCylinder("yurt", { height: 3.2, diameterTop: 1.5, diameterBottom: 6, tessellation: 10 }, scene)
      : MeshBuilder.CreateCylinder("tent", { height: 3.5, diameterTop: 0, diameterBottom: 5, tessellation: 4 }, scene);
    t.position.set(x, heightAt(x, z) + 1.7, z); t.material = tent;
    obs.push({ x, z, r: 2.8 });
  }
  const pole = MeshBuilder.CreateCylinder("pole", { height: 8, diameter: 0.25 }, scene);
  pole.position.set(c.x, heightAt(c.x, c.z) + 4, c.z);
  const f = MeshBuilder.CreatePlane("flag", { width: 2.4, height: 1.5, sideOrientation: Mesh.DOUBLESIDE }, scene);
  f.position.set(c.x + 1.2, heightAt(c.x, c.z) + 7.2, c.z); f.material = flag;
}
