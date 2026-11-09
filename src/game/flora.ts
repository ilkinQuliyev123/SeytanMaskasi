// Blender-də prosedur modellənmiş low-poly modellər (tools/blender/*.py → models/*.json):
// bitki örtüyü (flora.py) və yapon evləri (houses.py).
// Hər model: düz üçbucaqlar + vertex rəngi + Blender-in üz normalları → 1 meş, thin instance ilə çoxlu nüsxə.
import { Mesh, Scene, VertexData, type Material } from "@babylonjs/core";
import flora from "./models/flora.json";
import houses from "./models/houses.json";

export type FloraName = keyof typeof flora;
export type HouseName = keyof typeof houses;
type Raw = { p: number[]; n: number[]; c: number[] };

/** JSON modelindən meş */
export function lowpolyMesh(scene: Scene, name: string, d: Raw, mat: Material): Mesh {
  const n = d.p.length / 3, colors = new Float32Array(n * 4), normals = new Float32Array(n * 3), indices = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const f = Math.floor(i / 3);
    colors.set([d.c[f * 3] / 255, d.c[f * 3 + 1] / 255, d.c[f * 3 + 2] / 255, 1], i * 4);
    normals.set([d.n[f * 3], d.n[f * 3 + 1], d.n[f * 3 + 2]], i * 3);
    indices[i] = i;
  }
  // Blender (sağ əl) → Babylon (sol əl): üçbucaq sırasını çevir (?flora səhifəsində yoxlanıb)
  for (let i = 0; i < n; i += 3) { indices[i + 1] = i + 2; indices[i + 2] = i + 1; }
  const vd = new VertexData();
  vd.positions = new Float32Array(d.p); vd.normals = normals; vd.colors = colors; vd.indices = indices;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  m.material = mat; m.isPickable = false;
  return m;
}

export const floraMesh = (scene: Scene, name: FloraName, mat: Material) => lowpolyMesh(scene, name, flora[name] as Raw, mat);
/** yapon evi: bünövrə 7.5×6 m, ön tərəf −Z; miqyas w/7.5 × dd/6 */
export const houseMesh = (scene: Scene, name: HouseName, mat: Material) => lowpolyMesh(scene, name, houses[name] as Raw, mat);
export const HOUSE_W = 7.5, HOUSE_D = 6;
