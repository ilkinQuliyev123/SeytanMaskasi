// Blender-də prosedur modellənmiş low-poly bitki örtüyü (tools/blender/flora.py → models/flora.json).
// Hər model: düz üçbucaqlar + vertex rəngi + Blender-in üz normalları → 1 meş, thin instance ilə minlərlə nüsxə.
import { Mesh, Scene, VertexData, type Material } from "@babylonjs/core";
import data from "./models/flora.json";

export type FloraName = keyof typeof data;

/** JSON modelindən meş */
export function floraMesh(scene: Scene, name: FloraName, mat: Material): Mesh {
  const d = data[name] as { p: number[]; n: number[]; c: number[] };
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
