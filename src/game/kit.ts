// Low-poly model dəsti: hissələr vertex rəngi ilə boyanır və bir meşə birləşir (hər model = 1 çəkiliş).
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector4, VertexBuffer, type Material } from "@babylonjs/core";
import { pbr, TEX_M } from "./materials";

type V3 = [number, number, number];

export function paint<T extends Mesh>(m: T, hex: string): T {
  const c = Color3.FromHexString(hex), n = m.getTotalVertices(), a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b, 1], i * 4);
  m.setVerticesData(VertexBuffer.ColorKind, a);
  return m;
}

/** vertex rəngli material (səhnə başına bir dəfə) */
export function vcMat(scene: Scene, name = "vc", spec = 0.08, emissive?: string): StandardMaterial {
  const old = scene.getMaterialByName(name) as StandardMaterial | null;
  if (old) return old;
  const m = new StandardMaterial(name, scene);
  m.specularColor = new Color3(spec, spec, spec);
  m.specularPower = 24;
  if (emissive) { m.emissiveColor = Color3.FromHexString(emissive); m.disableLighting = true; }
  return m;
}

/** fənər/məşəl alovu: işıq saçır, dumanda da uzaqdan görünür */
export function glowMat(scene: Scene, hex = "#ffae4a", name = "glow" + hex) {
  const m = vcMat(scene, name, 0, hex);
  m.fogEnabled = false;
  return m;
}

export class Kit {
  private parts: Mesh[] = [];
  /** hamısını yuxarı sürüşdür (məs. atın üstündəki süvari) */
  dy = 0;
  /** bundan sonrakı hissələrin PBR toxuması ("" — yalnız vertex rəngi); UV ölçüyə görə təkrarlanır */
  tex = "";
  /** rəng → toxuma xəritəsi: [toxuma, çalar]; uyğun rəngli hissələr avtomatik toxuma alır */
  texMap: Record<string, [string, string]> = {};
  constructor(private scene: Scene) {}
  private T(hex: string) { return this.tex || this.texMap[hex]?.[0] || ""; }
  private add(m: Mesh, hex: string, p: V3, r: V3 = [0, 0, 0], s?: V3) {
    m.position.set(p[0], p[1] + this.dy, p[2]); m.rotation.set(...r);
    if (s) m.scaling.set(...s);
    const map = this.texMap[hex];
    m.metadata = { tex: this.T(hex) };
    this.parts.push(paint(m, map && !this.tex ? map[1] : hex));
    return this;
  }
  box(w: number, h: number, d: number, hex: string, p: V3, r?: V3) {
    const u = (a: number, b: number) => new Vector4(0, 0, a / TEX_M, b / TEX_M);
    const faceUV = this.T(hex) ? [u(w, h), u(w, h), u(d, h), u(d, h), u(w, d), u(w, d)] : undefined;
    return this.add(MeshBuilder.CreateBox("k", { width: w, height: h, depth: d, faceUV, wrap: true }, this.scene), hex, p, r);
  }
  cyl(h: number, dt: number, db: number, hex: string, p: V3, r?: V3, t = 8, s?: V3) {
    const k = s ? (s[0] + s[2]) / 2 : 1, side = new Vector4(0, 0, (Math.PI * k * (dt + db)) / 2 / TEX_M, Math.max(h, (db - dt) / 2) / TEX_M);
    const faceUV = this.T(hex) ? [new Vector4(0, 0, 1, 1), side, new Vector4(0, 0, 1, 1)] : undefined;
    return this.add(MeshBuilder.CreateCylinder("k", { height: h, diameterTop: dt, diameterBottom: db, tessellation: t, faceUV }, this.scene), hex, p, r, s);
  }
  sph(d: number, hex: string, p: V3, s?: V3, seg = 6, slice = 1) {
    return this.add(MeshBuilder.CreateSphere("k", { diameter: d, segments: seg, slice }, this.scene), hex, p, undefined, s);
  }
  /** dördbucaq «kalça» dam: w×d ölçüsündə, h hündürlükdə */
  roof(w: number, d: number, h: number, hex: string, p: V3, ry = 0, ridge = 0.25) {
    return this.cyl(h, Math.SQRT2 * ridge, Math.SQRT2, hex, p, [0, ry + Math.PI / 4, 0], 4, [w, 1, d].map((v, i) => i === 1 ? 1 : v) as V3);
  }
  build(name: string, mat: Material): Mesh {
    const m = Mesh.MergeMeshes(this.parts, true, true)!;
    m.name = name; m.material = mat; this.parts = [];
    return m;
  }
  /** toxumaya görə qruplaşdırıb birləşdirir: hər toxuma = 1 meş (az çəkiliş) */
  buildAll(name: string, plain: Material): Mesh[] {
    const groups = new Map<string, Mesh[]>();
    for (const p of this.parts) { const t = p.metadata?.tex ?? ""; groups.set(t, [...(groups.get(t) ?? []), p]); }
    this.parts = [];
    return [...groups].map(([t, parts]) => {
      const m = Mesh.MergeMeshes(parts, true, true, undefined, false, false)!;
      m.name = name + "_" + (t || "vc"); m.material = t ? pbr(this.scene, t) : plain; m.metadata = null;
      return m;
    });
  }
}

const BLK = "#17171b", BRASS = "#9a6a32", GOLD = "#d4a640", RED = "#a3171b", SKIN = "#c89a74", BONE = "#e8e0d0";

/** samuray — oni (şeytan) maskası, buynuzlu kabuto, lövhəli qara-mis zireh, belində katana */
function samurai(k: Kit) {
  for (const s of [-1, 1]) {
    k.cyl(0.8, 0.2, 0.15, BLK, [s * 0.16, 0.42, 0]).box(0.2, 0.28, 0.06, BRASS, [s * 0.16, 0.58, 0.11])
      .box(0.15, 0.06, 0.3, "#c8b48a", [s * 0.16, 0.03, 0.05])
      .box(0.08, 0.42, 0.36, BLK, [s * 0.4, 1.47, 0], [0, 0, -s * 0.35]).box(0.085, 0.05, 0.37, BRASS, [s * 0.47, 1.3, 0], [0, 0, -s * 0.35])
      .cyl(0.62, 0.14, 0.12, BLK, [s * 0.38, 1.12, 0.04], [0.15, 0, s * 0.12]).cyl(0.22, 0.13, 0.13, BRASS, [s * 0.4, 0.95, 0.08], [0.15, 0, s * 0.12])
      .box(0.04, 0.4, 0.03, GOLD, [s * 0.12, 2.06, 0.18], [0.25, 0, s * 0.45]) // buynuzlar (kuwagata)
      .cyl(0.14, 0, 0.05, BONE, [s * 0.08, 1.96, 0.24], [0.4, 0, s * 0.35], 5) // maskanın kiçik buynuzları
      .box(0.07, 0.025, 0.02, "#ffd84a", [s * 0.065, 1.85, 0.28]); // gözlər
  }
  for (let i = 0; i < 6; i++) { // kusazuri — ətək lövhələri
    const a = (i / 6) * Math.PI * 2, x = Math.sin(a) * 0.27, z = Math.cos(a) * 0.27;
    k.box(0.25, 0.42, 0.04, BLK, [x, 0.92, z], [-0.25, a, 0]).box(0.26, 0.05, 0.045, BRASS, [x * 1.13, 0.73, z * 1.13], [-0.25, a, 0]);
  }
  k.cyl(0.6, 0.62, 0.5, BRASS, [0, 1.36, 0], undefined, 8, [1, 1, 0.8]) // dō — döş zirehi
    .cyl(0.05, 0.64, 0.64, BLK, [0, 1.2, 0], undefined, 8, [1, 1, 0.82]).cyl(0.05, 0.66, 0.66, BLK, [0, 1.42, 0], undefined, 8, [1, 1, 0.82])
    .cyl(0.1, 0.56, 0.56, "#3a2a1e", [0, 1.07, 0], undefined, 8, [1, 1, 0.82])
    .sph(0.44, BLK, [0, 1.9, -0.02], [1, 0.85, 1]).cyl(0.2, 0.42, 0.66, BLK, [0, 1.76, -0.04], undefined, 10) // kabuto + boyunluq
    .cyl(0.035, 0.68, 0.68, BRASS, [0, 1.67, -0.04], undefined, 10)
    .sph(0.33, RED, [0, 1.8, 0.16], [1, 0.95, 0.62]) // oni maskası
    .box(0.17, 0.035, 0.02, BONE, [0, 1.71, 0.27]).box(0.1, 0.06, 0.06, RED, [0, 1.78, 0.29])
    .cyl(0.38, 0.03, 0.16, "#0c0c0c", [0, 2.18, -0.08], [-0.35, 0, 0], 6) // qara kəkil
    .box(0.035, 0.035, 0.95, "#111111", [0.3, 1.0, -0.1], [0.45, 0.25, 0]).cyl(0.02, 0.1, 0.1, GOLD, [0.27, 1.17, 0.27], [Math.PI / 2 + 0.45, 0, 0], 8);
}

function ninja(k: Kit) {
  const N = "#121216";
  for (const s of [-1, 1]) k.cyl(0.85, 0.18, 0.13, N, [s * 0.14, 0.43, 0]).cyl(0.6, 0.12, 0.1, N, [s * 0.32, 1.15, 0.03], [0.1, 0, s * 0.1]);
  k.cyl(0.65, 0.48, 0.42, N, [0, 1.2, 0]).cyl(0.07, 0.46, 0.46, "#5a1414", [0, 0.98, 0])
    .sph(0.4, N, [0, 1.72, 0]).box(0.3, 0.06, 0.05, SKIN, [0, 1.76, 0.18])
    .box(0.03, 0.03, 0.7, "#222", [-0.05, 1.35, -0.22], [0, 0, 0.8]);
}

/** yeniçəri — ağ uzun börk, tünd-qırmızı kaftan, mavi qurşaq, tüfəng */
function yeniceri(k: Kit, coat = "#8c1c1c", hat = "turban"): Kit {
  for (const s of [-1, 1]) k.cyl(0.5, 0.15, 0.13, "#2a2420", [s * 0.13, 0.25, 0]).cyl(0.62, 0.15, 0.12, coat, [s * 0.34, 1.18, 0.03], [0.1, 0, s * 0.12])
    .sph(0.1, SKIN, [s * 0.36, 0.86, 0.07]);
  k.cyl(1.25, 0.46, 0.78, coat, [0, 0.95, 0], undefined, 10).cyl(0.12, 0.5, 0.5, "#1f3c88", [0, 1.08, 0], undefined, 10)
    .cyl(0.32, 0.48, 0.44, "#e9e2cf", [0, 1.5, 0], undefined, 8, [1, 1, 0.85])
    .sph(0.36, SKIN, [0, 1.82, 0]).box(0.18, 0.04, 0.05, "#2a1d14", [0, 1.75, 0.17]);
  if (hat === "bork") {
    k.cyl(0.62, 0.32, 0.3, "#f2eee4", [0, 2.18, -0.06], [-0.22, 0, 0], 10)
      .box(0.28, 0.6, 0.04, "#f2eee4", [0, 1.98, -0.27], [0.25, 0, 0]).cyl(0.1, 0.08, 0.1, GOLD, [0, 2.0, 0.12], [-0.2, 0, 0], 6);
  } else k.sph(0.48, "#f2eee4", [0, 2.0, 0], [1, 0.75, 1]).cyl(0.18, 0.08, 0.14, coat, [0, 2.18, 0], undefined, 6);
  return k;
}

/** at + üstündə süvari */
function horse(k: Kit, coat: string, rider: (k: Kit) => unknown, hide = "#4a3222") {
  k.box(0.75, 0.8, 2.1, hide, [0, 1.35, 0]).box(0.4, 0.9, 0.55, hide, [0, 1.9, 1.05], [-0.6, 0, 0]).box(0.32, 0.36, 0.75, hide, [0, 2.25, 1.45], [0.35, 0, 0])
    .box(0.1, 0.7, 0.12, "#1b120c", [0, 1.65, -1.1], [0.5, 0, 0]).box(0.8, 0.12, 1.0, coat, [0, 1.8, 0]);
  for (const [x, z] of [[-0.25, 0.8], [0.25, 0.8], [-0.25, -0.8], [0.25, -0.8]]) k.cyl(1.0, 0.16, 0.12, hide, [x, 0.5, z], undefined, 5);
  k.dy = 0.85; rider(k); k.dy = 0;
}

function mongol(k: Kit) {
  return yeniceri(k, "#7a5230", "turban");
}

const MODELS: Record<string, (k: Kit) => unknown> = {
  samurai, ninja, yeniceri: (k) => yeniceri(k, "#8c1c1c", "bork"), ottoman: (k) => yeniceri(k, "#2e5d3a"), mongol,
  okcu: (k) => yeniceri(k, "#3d5a2a", "bork").box(0.04, 1.2, 0.05, "#5a3a22", [-0.42, 1.2, 0.1]),
  mulki: (k) => yeniceri(k, "#7a5a3a"),
  koylu: (k) => { for (const s of [-1, 1]) k.cyl(0.7, 0.14, 0.12, "#2a2a30", [s * 0.13, 0.35, 0]).cyl(0.6, 0.14, 0.12, "#4a5a6a", [s * 0.33, 1.15, 0.03], [0.1, 0, s * 0.12]);
    return k.cyl(1.0, 0.5, 0.62, "#4a5a6a", [0, 1.0, 0], undefined, 10).cyl(0.1, 0.52, 0.52, "#2a2a30", [0, 1.15, 0], undefined, 10)
      .sph(0.36, SKIN, [0, 1.72, 0]).cyl(0.3, 0.06, 1.0, "#c8b070", [0, 2.0, 0], undefined, 12); }, // kimono + saman papaq (kasa)
  mulki2: (k) => k.cyl(1.5, 0.4, 0.8, "#5e3f5e", [0, 0.78, 0], undefined, 10).sph(0.36, SKIN, [0, 1.75, 0])
    .sph(0.46, "#d9cdb4", [0, 1.8, -0.04], [1, 1.1, 1]).cyl(0.55, 0.12, 0.12, "#5e3f5e", [0.3, 1.2, 0.05], [0.1, 0, 0.1], 6).cyl(0.55, 0.12, 0.12, "#5e3f5e", [-0.3, 1.2, 0.05], [0.1, 0, -0.1], 6),
  sipahi: (k) => horse(k, "#7a1f1f", (r) => yeniceri(r, "#7a1f1f").cyl(0.6, 0.02, 0.22, "#8a8f96", [0, 2.35, 0], undefined, 8), "#3a2618"),
  atli_okcu: (k) => horse(k, "#2e5d3a", (r) => yeniceri(r, "#5a3d22").box(0.04, 1.2, 0.05, "#5a3a22", [-0.42, 1.2, 0.1]), "#6a4a2e"),
};

export function unitModel(scene: Scene, id: string): Mesh {
  const k = new Kit(scene);
  (MODELS[id] ?? mongol)(k);
  return k.build("model_" + id, vcMat(scene, "vcArmor", 0.25));
}

/** oyunçunun silahları (sağ əldə, +z irəli) */
export function weaponModel(scene: Scene, id: string): Mesh {
  const k = new Kit(scene), M = "#1c1d20", W = "#5a3a22";
  if (id === "pbow") k.box(0.03, 1.3, 0.05, W, [0, 0, 0.05]).box(0.03, 0.4, 0.04, W, [0, 0.5, -0.08], [0.6, 0, 0]).box(0.03, 0.4, 0.04, W, [0, -0.5, -0.08], [-0.6, 0, 0]).box(0.005, 1.2, 0.005, BONE, [0, 0, -0.18]);
  else if (id === "glock") k.box(0.04, 0.12, 0.2, M, [0, 0, 0.1]).box(0.04, 0.13, 0.06, M, [0, -0.1, 0.03], [0.25, 0, 0]);
  else {
    const L = id === "sniper" ? 1.35 : id === "aug" ? 0.75 : 0.95;
    k.box(0.06, 0.12, L * 0.6, M, [0, 0, L * 0.15]).cyl(L * 0.5, 0.035, 0.035, M, [0, 0.02, L * 0.6], [Math.PI / 2, 0, 0], 6)
      .box(0.05, 0.14, 0.3, id === "aug" ? "#3d4a34" : M, [0, -0.02, -L * 0.25]).box(0.04, 0.16, 0.05, M, [0, -0.13, L * 0.08]);
    if (id === "sniper" || id === "aug") k.cyl(id === "sniper" ? 0.4 : 0.2, 0.07, 0.07, "#0d0d0f", [0, 0.11, L * 0.12], [Math.PI / 2, 0, 0], 8);
    if (id === "m16") k.box(0.03, 0.06, 0.2, M, [0, 0.09, L * 0.05]);
    if (id === "sniper") k.box(0.02, 0.25, 0.02, M, [0.06, -0.12, L * 0.75], [0, 0, 0.4]).box(0.02, 0.25, 0.02, M, [-0.06, -0.12, L * 0.75], [0, 0, -0.4]);
  }
  return k.build("w_" + id, vcMat(scene, "vcGun", 0.35));
}

export function cannonModel(scene: Scene): Mesh {
  const k = new Kit(scene), W = "#4a3020";
  k.box(1.0, 0.45, 1.8, W, [0, 0.45, 0]).cyl(2.3, 0.32, 0.46, "#a87b3c", [0, 0.95, 0.35], [Math.PI / 2 - 0.08, 0, 0], 10)
    .cyl(0.08, 0.5, 0.5, "#8a6330", [0, 0.97, 1.45], [Math.PI / 2, 0, 0], 10);
  for (const s of [-1, 1]) k.cyl(0.12, 0.85, 0.85, W, [s * 0.58, 0.42, -0.3], [0, 0, Math.PI / 2], 10);
  return k.build("cannon", vcMat(scene, "vcArmor", 0.25));
}
