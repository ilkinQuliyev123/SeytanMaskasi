// Qurtuluş Savaşı xəritəsi — dünya. Dar vadi: sağda və solda dağ silsiləsi, meydan dağlarda bitir.
// Qərbdə kənd və divarlı kazarma (döyüşə buradan çıxırıq) → 200 m otlaq və samanlıq → 200 m-dən bir 10 səngər xətti → sahil → dəniz (donanma).
// Səngərlər arası otlu-ağaclı-kollu təpələr; dağ ətəklərində 6 top təpəsi (ən hündüründə böyük top, ora ziqzaq yol çıxır).
// Koordinatlar: +x — dənizə (şərq, günəş dənizdən doğur), z — vadinin eni.
import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Texture, Vector2, Vector3, VertexBuffer } from "@babylonjs/core";
import { Grid, heightAt, rng, setGroundSampler } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";
import { environment, pbr, terrainMaterial } from "./materials";
import { scatter, scatterChunked, segObs, setGrassFn, tm as M, type Quality } from "./world";
import { floraMesh } from "./flora";

export const TRENCH_X = Array.from({ length: 10 }, (_, i) => -1000 + i * 200); // 200 m-dən bir: −1000…800
export const TRENCH_Z = 245; // səngərlər vadinin bütün enində
export const COAST = 960; // su xətti
export const OUR_BARRACKS = { x: -1290, z: 0 };
export const COMPOUND = { x0: -1345, x1: -1190, z0: -95, z1: 95 }; // kazarma divarları (darvaza şərqdə)
/** darvazanın yarım eni: 100 əsgər birlikdə çıxa bilsin (40 m) */
export const GATE_HALF = 20;
export const MEADOW = { x0: -1185, x1: -1015 }; // otlaq və samanlıq
export const VILLAGE = { x: -1300, z: 0, r: 175 };
/** sığınacaq: arxasında gizlənib döyüşmək olar (h — hündürlük) */
export type Cover = { x: number; z: number; r: number; h: number; n: number };
export const VALLEY = 310; // |z| > VALLEY — dağ yamacı başlayır
/** oyun meydanı: uzunluq — kənddən gəmilərə qədər, en — iki dağ arası */
export const AREA = { x0: -1460, x1: 1500, z0: -340, z1: 340 };
export const ENEMY_BARRACKS = [{ x: -500, z: 150 }, { x: 100, z: -150 }, { x: 700, z: 135 }];
export interface Hill { x: number; z: number; h: number; s: number; big?: boolean }
export const HILLS: Hill[] = [
  { x: 300, z: -325, h: 92, s: 62, big: true }, // ən hündür — böyük sahil topu
  { x: -650, z: 305, h: 34, s: 40 }, { x: -200, z: -315, h: 36, s: 40 }, { x: 100, z: 310, h: 38, s: 40 },
  { x: 500, z: 310, h: 36, s: 40 }, { x: 720, z: -310, h: 33, s: 38 },
];
const G0 = { x0: -1620, x1: 1060, z0: -620, z1: 620 }; // relyef meşi

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const baseAt = (x: number, z: number) => 3 + 1.2 * Math.sin(x * 0.011 + 0.5) * Math.cos(z * 0.013) + 0.6 * Math.sin(x * 0.029) * Math.sin(z * 0.025 + 1);

/** səngərlər arasındakı təpələr (yerində boşluqlar var ki, keçmək olsun) */
export function ridgeAt(x: number, z: number) {
  if (x < -930 || x > 930 || Math.abs(z) > VALLEY) return 0;
  let r = 0;
  for (let i = 0; i < 9; i++) {
    const dx = x - (TRENCH_X[i] + 100);
    if (Math.abs(dx) > 70) continue;
    const gate = clamp01(0.5 + 0.65 * Math.sin(z * 0.028 + i * 1.7));
    r += 8.5 * gate * Math.exp(-(dx * dx) / (2 * 22 * 22));
  }
  return r;
}
const FLAT = [{ x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r, r2: VILLAGE.r + 40 }, ...ENEMY_BARRACKS.map((b) => ({ x: b.x, z: b.z, r: 34, r2: 56 }))];
const hillAt = (x: number, z: number) => HILLS.reduce((h, c) => h + c.h * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.s * c.s)), 0);
/** vadinin iki yanında dağ silsiləsi + qərbdə (kəndin arxası) */
const mountain = (x: number, z: number) => {
  const e = Math.max(0, Math.abs(z) - VALLEY, AREA.x0 + 40 - x) , n = 1 + 0.25 * Math.sin(x * 0.013) + 0.15 * Math.sin(x * 0.041 + z * 0.02);
  return Math.min(230, e * e * 0.0075 * n);
};

export function kurtulusRaw(x: number, z: number) {
  let h = baseAt(x, z) + ridgeAt(x, z) + hillAt(x, z);
  for (const f of FLAT) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r2) h = lerp(baseAt(f.x, f.z), h, smooth(f.r, f.r2, d)); }
  h += mountain(x, z);
  return lerp(h, -9, smooth(COAST - 40, COAST + 45, x)); // sahil → dəniz dibi
}
const nearTrench = (x: number, z: number, pad = 9) => Math.abs(z) < TRENCH_Z + pad && TRENCH_X.some((t) => Math.abs(x - t) < pad);
/** səngərlər arası birləşdirici səngərlər (yollar): hər boşluqda iki */
export const LINKS = TRENCH_X.slice(0, -1).flatMap((x, i) => [[-150, 110][i % 2], [60, -60][i % 2]].map((z) => ({ x1: x + 2.5, x2: x + 200 - 2.5, z })));
const onLink = (x: number, z: number, pad = 5) => LINKS.some((l) => x > l.x1 - 2 && x < l.x2 + 2 && Math.abs(z - l.z) < pad);
/** böyük təpəyə ziqzaq yol (vadi tərəfindən) */
const BIG = HILLS[0];
export const hillRoad = Array.from({ length: 160 }, (_, i) => {
  const t = i / 159;
  return { x: BIG.x + 70 * Math.sin(t * Math.PI * 3.5) * (1 - t * 0.85), z: BIG.z + 150 - t * 146 };
});
const onRoad = (x: number, z: number, pad = 6) => Math.abs(x - BIG.x) < 90 && z > BIG.z - 10 && z < BIG.z + 160 && hillRoad.some((p) => Math.abs(p.x - x) < pad && Math.abs(p.z - z) < pad);
const inMeadow = (x: number, z: number) => x > MEADOW.x0 && x < MEADOW.x1 && Math.abs(z) < VALLEY - 10;
/** oyunçu hündür otda gizlənir: təpələrin otlu yamacları və otlağın biçilməmiş zolaqları */
export const kurtulusGrass = (x: number, z: number) => (ridgeAt(x, z) > 2.5 && !nearTrench(x, z, 6) && !onLink(x, z, 3)) || (inMeadow(x, z) && Math.sin(z * 0.045) > 0.55);

export interface Post { x: number; z: number; trench: number }
export function buildKurtulus(scene: Scene, quality: Quality) {
  const grid = new Grid(), anchors: Vector3[] = [], r0 = rng(7);
  const sx = quality === "mid" ? 540 : 360, sz = quality === "mid" ? 250 : 160;
  const ground = MeshBuilder.CreateGround("ground", { width: G0.x1 - G0.x0, height: G0.z1 - G0.z0, subdivisionsX: sx, subdivisionsY: sz, updatable: true }, scene);
  ground.position.set((G0.x0 + G0.x1) / 2, 0, (G0.z0 + G0.z1) / 2);
  const pos = ground.getVerticesData(VertexBuffer.PositionKind)!, col: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] + ground.position.x, z = pos[i + 2] + ground.position.z, h = kurtulusRaw(x, z);
    pos[i + 1] = h;
    const slope = Math.abs(kurtulusRaw(x + 4, z) - h) + Math.abs(kurtulusRaw(x, z + 4) - h);
    const rock = clamp01(Math.max((slope - 3.4) / 4, (h - 120) / 40));
    const meadow = clamp01(0.55 + 0.45 * Math.sin(x * 0.017 + 1) * Math.cos(z * 0.013) + (r0() - 0.5) * 0.25);
    let c = [(1 - rock) * (1 - meadow) * 0.6, (1 - rock) * meadow, rock];
    if (x > COAST - 45) c = [0, 0.05 * (1 - clamp01((x - COAST + 45) / 30)), 0.12]; // qumlu sahil
    else if (nearTrench(x, z, 10) || onLink(x, z, 4)) c = [0.05, 0.12, 0.02]; // səngər ətrafı — eşilmiş torpaq
    else if (inMeadow(x, z)) c = [0.02, 0.85, 0]; // otlaq
    else if (x > TRENCH_X[0] - 30 && x < COAST - 40 && Math.abs(z) < TRENCH_Z + 20 && ridgeAt(x, z) < 1.2) c = [c[0] * 0.5, c[1] * 0.45, c[2]]; // döyüş sahəsi — çox torpaq
    for (const f of FLAT) if (Math.hypot(x - f.x, z - f.z) < f.r - 8) c = [0.05, 0.25, 0.02];
    col.push(c[0], c[1], c[2], 1);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, pos);
  ground.setVerticesData(VertexBuffer.ColorKind, col);
  ground.createNormals(false); ground.updateCoordinateHeights();
  ground.isPickable = false; ground.receiveShadows = true; ground.freezeWorldMatrix();
  setGroundSampler((x, z) => (x > G0.x1 - 6 ? -9 : ground.getHeightAtCoordinates(x, z)));
  setGrassFn(kurtulusGrass);
  const env = environment(scene); env.level = 0.6;
  ground.material = terrainMaterial(scene);

  const sea = buildSea(scene);
  buildVillage(scene, grid, anchors);
  const covers: Cover[] = [];
  buildMeadow(scene, grid, covers);
  ENEMY_BARRACKS.forEach((b, i) => buildEnemyBarracks(scene, grid, b.x, b.z, i));
  const posts = buildTrenches(scene, quality);
  buildHillRoad(scene);
  buildVegetation(scene, quality);
  buildCraters(scene);
  buildRocks(scene, grid, covers);
  return { ground, grid, anchors, posts, sea, covers };
}

// --- dəniz: prosedur dalğa normalı (hər kadr sürüşür) + günəşə doğru parıltı ---
function buildSea(scene: Scene) {
  const S = 256, t = new DynamicTexture("seaNor", S, scene, true), c = t.getContext() as CanvasRenderingContext2D, img = c.createImageData(S, S);
  const W = [[3, 1, 0.5, 0.3], [1, 4, 0.35, 1.7], [5, -2, 0.25, 0.9], [7, 3, 0.12, 2.2], [-2, 9, 0.1, 0.4]];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, a, ph] of W) { const k = Math.cos(((fx * x + fy * y) / S) * Math.PI * 2 + ph) * a * Math.PI * 2; dx += k * fx; dy += k * fy; }
    const n = new Vector3(-dx * 0.06, -dy * 0.06, 1).normalize(), o = (y * S + x) * 4;
    img.data[o] = (n.x * 0.5 + 0.5) * 255; img.data[o + 1] = (n.y * 0.5 + 0.5) * 255; img.data[o + 2] = (n.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0); t.update(); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.uScale = t.vScale = 220;
  const m = new StandardMaterial("sea", scene);
  m.diffuseColor = new Color3(0.05, 0.13, 0.19); m.specularColor = new Color3(1, 0.72, 0.45); m.specularPower = 70;
  m.bumpTexture = t; m.bumpTexture.level = 0.5; m.emissiveColor = new Color3(0.02, 0.05, 0.08);
  const sea = MeshBuilder.CreateGround("seaPlane", { width: 12000, height: 12000 }, scene);
  sea.position.set(COAST + 5200, 0, 0); sea.material = m; sea.isPickable = false;
  m.freeze();
  return { mesh: sea, tex: t };
}

const STONE = "#b8ab8f", PLASTER = "#e2d6bf", WOOD = "#4a3020", TILE = "#8e4a2e", EARTH = "#5b4a36", BAG = "#9a8a64", HAY = "#c9a85a";
const TM: Record<string, [string, string]> = { [STONE]: ["sandstone", "#e0d4bc"], [PLASTER]: ["plaster", "#ffffff"], [WOOD]: ["cedar", "#6a4a34"], [TILE]: ["roof", "#ffffff"], [EARTH]: ["dirt", "#b49a7c"] };
function rect(g: Grid, x: number, z: number, w: number, d: number, rot: number) { // fırlanmış düzbucaqlı → dairələr
  const c = Math.cos(rot), s = Math.sin(rot), long = d > w, L = Math.max(w, d), r = Math.min(w, d) / 2;
  const ax = long ? s : c, az = long ? c : -s, h = L / 2 - r;
  segObs(g, x - ax * h, z - az * h, x + ax * h, z + az * h, r + 0.2);
}

// --- bizim kənd + divarlı kazarma (darvaza şərqdə — döyüşə buradan çıxırıq) ---
function buildVillage(scene: Scene, grid: Grid, anchors: Vector3[]) {
  const k = new Kit(scene), glow = new Kit(scene), r = rng(9);
  k.texMap = TM;
  const house = (x: number, z: number, w: number, d: number, rot: number, floors = 1) => {
    const y = heightAt(x, z) - 0.3, H = 3.2 * floors, R: [number, number, number] = [0, rot, 0];
    k.box(w, H, d, floors > 1 ? PLASTER : STONE, [x, y + H / 2, z], R).box(w + 0.3, 0.5, d + 0.3, STONE, [x, y + 0.25, z], R)
      .roof(w + 1.2, d + 1.2, 1.7, TILE, [x, y + H + 0.85, z], rot, 0.3)
      .box(1, 2, 0.12, WOOD, [x + Math.sin(rot) * (d / 2 + 0.03), y + 1, z + Math.cos(rot) * (d / 2 + 0.03)], R);
    if (r() < 0.5) glow.box(0.7, 0.7, 0.1, "#ffffff", [x + Math.sin(rot) * (d / 2 + 0.06) + Math.cos(rot) * 1.6, y + 2, z + Math.cos(rot) * (d / 2 + 0.06) - Math.sin(rot) * 1.6], R);
    rect(grid, x, z, w, d, rot);
  };
  // kazarma binası 50×14, qapısı şərqə
  const B = OUR_BARRACKS, by = heightAt(B.x, B.z) - 0.3;
  k.box(14, 5, 50, STONE, [B.x, by + 2.5, B.z]).roof(15.5, 51.5, 2.6, TILE, [B.x, by + 6.3, B.z], 0, 0.15);
  for (let i = -3; i <= 3; i++) glow.box(0.1, 1, 1.6, "#ffffff", [B.x + 7.06, by + 2.6, B.z + i * 6.5]);
  k.box(0.15, 3.2, 3.6, WOOD, [B.x + 7.05, by + 1.6, B.z]);
  rect(grid, B.x, B.z, 14, 50, 0);
  anchors.push(new Vector3(B.x + 8, by + 3, B.z));
  // kazarma divarları: 2.6 m daş divar, şərqdə 40 m enli darvaza (bütün dəstə birlikdə çıxır)
  const C = COMPOUND, wall = (x1: number, z1: number, x2: number, z2: number) => {
    const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, y = heightAt(cx, cz) - 0.4;
    k.box(1, 2.9, L, STONE, [cx, y + 1.45, cz], [0, a, 0]).box(1.3, 0.3, L + 0.3, STONE, [cx, y + 3, cz], [0, a, 0]);
    segObs(grid, x1, z1, x2, z2, 0.8);
  };
  wall(C.x0, C.z0, C.x1, C.z0); wall(C.x0, C.z1, C.x1, C.z1); wall(C.x0, C.z0, C.x0, C.z1);
  const G = GATE_HALF;
  wall(C.x1, C.z0, C.x1, -G); wall(C.x1, G, C.x1, C.z1);
  for (const s of [-1, 1]) { k.box(2.6, 6, 2.6, STONE, [C.x1, heightAt(C.x1, s * (G + 1.2)) + 2.6, s * (G + 1.2)]); grid.add({ x: C.x1, z: s * (G + 1.2), r: 1.6 }); }
  // bayraq: şimal darvaza sütununun yanında (keçidə mane olmasın)
  const FZ = G + 1.2, fy = heightAt(C.x1, FZ);
  k.box(0.3, 8, 0.3, WOOD, [C.x1 - 1, fy + 9, FZ]);
  const flag = new Kit(scene); flag.box(0.05, 2.2, 3.4, "#c8102e", [C.x1 - 1, fy + 11.6, FZ + 1.8]);
  flag.cyl(0.05, 0.7, 0.7, "#ffffff", [C.x1 - 0.97, fy + 11.7, FZ + 1.6], [0, 0, Math.PI / 2], 14).cyl(0.06, 0.6, 0.6, "#c8102e", [C.x1 - 0.96, fy + 11.7, FZ + 1.75], [0, 0, Math.PI / 2], 14)
    .box(0.06, 0.25, 0.25, "#ffffff", [C.x1 - 0.95, fy + 11.7, FZ + 2.25], [Math.PI / 4, 0, 0]);
  flag.build("flag", vcMat(scene, "vcFlag", 0.1)).isPickable = false;
  // məscid
  const mx = VILLAGE.x - 90, mz = 130, my = heightAt(mx, mz) - 0.3;
  k.box(13, 8, 13, STONE, [mx, my + 4, mz]).sph(10, "#8a8f96", [mx, my + 8, mz], [1, 0.9, 1], 10, 0.5)
    .cyl(24, 1.6, 2, STONE, [mx + 8, my + 12, mz - 6], undefined, 10).cyl(0.6, 2.6, 2.6, STONE, [mx + 8, my + 19, mz - 6], undefined, 10)
    .cyl(4, 0, 1.8, "#8a8f96", [mx + 8, my + 26, mz - 6], undefined, 10);
  rect(grid, mx, mz, 13, 13, 0); grid.add({ x: mx + 8, z: mz - 6, r: 1.3 });
  // evlər: kazarma divarlarının şimalında və cənubunda, qərbdə
  for (let i = 0; i < 46; i++) {
    const x = VILLAGE.x - 140 + r() * 210, z = (r() < 0.5 ? -1 : 1) * (110 + r() * 160);
    if (Math.abs(z) > VALLEY - 25 || Math.hypot(x - mx, z - mz) < 18) continue;
    house(x, z, 6 + r() * 3, 5 + r() * 2.5, r() * 6, r() < 0.3 ? 2 : 1);
  }
  for (let i = 0; i < 10; i++) { const x = C.x0 - 25 - r() * 70, z = (r() - 0.5) * 180; house(x, z, 6 + r() * 3, 5 + r() * 2, r() * 6); }
  for (const m of k.buildAll("village", vcMat(scene, "vcWorld", 0.05))) { m.metadata = { solid: true }; m.freezeWorldMatrix(); }
  glow.build("villageGlow", glowMat(scene, "#ffb35a")).isPickable = false;
}

// --- 200 m otlaq və samanlıq: taya, rulon, taxta hasar ---
function buildMeadow(scene: Scene, grid: Grid, covers: Cover[]) {
  const k = new Kit(scene), r = rng(41);
  k.texMap = { [WOOD]: TM[WOOD] };
  for (let i = 0; i < 34; i++) { // ot tayaları
    const x = MEADOW.x0 + 15 + r() * (MEADOW.x1 - MEADOW.x0 - 30), z = (r() - 0.5) * 2 * (VALLEY - 40), y = heightAt(x, z);
    if (Math.abs(z) < 26) continue; // yol (darvaza qədər enli)
    k.cyl(2.2, 3.6, 4.2, HAY, [x, y + 1.0, z], undefined, 10).cyl(2.2, 0.3, 3.6, "#b8964a", [x, y + 3.2, z], undefined, 10).cyl(4.6, 0.12, 0.12, WOOD, [x, y + 2.6, z], undefined, 5);
    grid.add({ x, z, r: 2.1 }); covers.push({ x, z, r: 2.1, h: 3.2, n: 0 });
  }
  for (let i = 0; i < 70; i++) { // rulon samanlar
    const x = MEADOW.x0 + 10 + r() * (MEADOW.x1 - MEADOW.x0 - 20), z = (r() - 0.5) * 2 * (VALLEY - 40);
    if (Math.abs(z) < 24) continue;
    k.cyl(1.4, 1.5, 1.5, HAY, [x, heightAt(x, z) + 0.72, z], [0, r() * 3, Math.PI / 2], 10);
  }
  for (const x of [MEADOW.x0, MEADOW.x1]) for (let z = -VALLEY + 30; z < VALLEY - 30; z += 4) { // taxta hasarlar (ortada keçid)
    if (Math.abs(z) < 24) continue;
    const y = heightAt(x, z);
    k.box(0.15, 1.3, 0.15, WOOD, [x, y + 0.6, z]).box(0.08, 0.12, 4, WOOD, [x, y + 0.9, z + 2]).box(0.08, 0.12, 4, WOOD, [x, y + 0.45, z + 2]);
  }
  for (const m of k.buildAll("meadow", vcMat(scene, "vcWorld", 0.05))) { m.isPickable = false; m.freezeWorldMatrix(); }
}

// --- qayalar: əsgər boyundan ~1 m hündür (2.6–3.3 m) — arxasında gizlənib yandan atəş açırlar ---
function buildRocks(scene: Scene, grid: Grid, covers: Cover[]) {
  const k = new Kit(scene), r = rng(77);
  k.texMap = { [STONE]: TM[STONE] };
  for (let i = 0, n = 0; i < 4000 && n < 170; i++) {
    const x = MEADOW.x1 + 20 + r() * (COAST - 60 - MEADOW.x1 - 20), z = (r() - 0.5) * 2 * (VALLEY - 45);
    if (nearTrench(x, z, 14) || onLink(x, z, 6) || onRoad(x, z) || Math.abs(z) < 8 ||
      FLAT.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 4) || HILLS.some((h) => Math.hypot(x - h.x, z - h.z) < (h.big ? 30 : 14)) ||
      covers.some((c) => Math.hypot(c.x - x, c.z - z) < 14)) continue;
    const h = 2.6 + r() * 0.7, rad = 1.3 + r() * 0.9, y = heightAt(x, z), a = r() * 6;
    k.sph(1, STONE, [x, y + h * 0.42, z], [rad * 2, h * 1.12, rad * 1.7], 6)
      .sph(1, STONE, [x + Math.sin(a) * rad * 0.6, y + h * 0.25, z + Math.cos(a) * rad * 0.6], [rad * 1.5, h * 0.7, rad * 1.4], 5);
    grid.add({ x, z, r: rad }); covers.push({ x, z, r: rad, h, n: 0 }); n++;
  }
  for (const m of k.buildAll("rocks", vcMat(scene, "vcWorld", 0.05))) { m.metadata = { solid: true }; m.freezeWorldMatrix(); }
}

// --- düşmən kazarması: uzun bina, çadırlar, qum torbası halqası ---
function buildEnemyBarracks(scene: Scene, grid: Grid, x: number, z: number, i: number) {
  const k = new Kit(scene), y = heightAt(x, z) - 0.3, r = rng(30 + i);
  k.texMap = TM;
  k.box(12, 4.6, 40, PLASTER, [x, y + 2.3, z]).roof(13.4, 41.4, 2.2, TILE, [x, y + 5.7, z], 0, 0.15);
  for (let j = -2; j <= 2; j++) k.box(0.12, 1, 1.5, "#2a2a2a", [x - 6.05, y + 2.6, z + j * 7]);
  rect(grid, x, z, 12, 40, 0);
  for (let j = 0; j < 6; j++) {
    const tx = x + 14 + (j % 2) * 8, tz = z - 18 + Math.floor(j / 2) * 15, ty = heightAt(tx, tz);
    k.cyl(3, 0.2, 5.6, "#8a8468", [tx, ty + 1.5, tz], [0, r() * 0.3 + Math.PI / 4, 0], 4);
    grid.add({ x: tx, z: tz, r: 2.4 });
  }
  for (let j = 0; j < 40; j++) {
    const a = (j / 40) * Math.PI * 2, bx = x + Math.sin(a) * 30, bz = z + Math.cos(a) * 30;
    if (Math.abs(Math.sin(a)) > 0.95) continue;
    k.box(1.4, 0.9, 0.6, BAG, [bx, heightAt(bx, bz) + 0.4, bz], [0, a + Math.PI / 2, 0]);
  }
  for (const m of k.buildAll("enemyBarracks" + i, vcMat(scene, "vcWorld", 0.05))) { m.metadata = { solid: true }; m.freezeWorldMatrix(); }
}

// --- 10 səngər xətti: ziqzaq, qabaqda qum torbalı parapet, arxada torpaq tökmə, dirəklər, taxta döşəmə; qabaqda tikanlı məftil ---
function buildTrenches(scene: Scene, quality: Quality): Post[][] {
  const k = new Kit(scene), bags = new Kit(scene), wire = new Kit(scene), r = rng(12);
  k.texMap = TM;
  const all: Post[][] = [];
  const wall = (ax: number, az: number, bx: number, bz: number, off: number, h: number, w: number, color = EARTH) => {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L, a = Math.atan2(dx, dz);
    const mx = (ax + bx) / 2 + nx * off, mz = (az + bz) / 2 + nz * off;
    k.box(w, h, L + 0.5, color, [mx, heightAt(mx, mz) + h / 2 - 0.15, mz], [0.0, a, 0]);
    return { mx, mz, a, L, nx, nz };
  };
  TRENCH_X.forEach((tx, ti) => {
    const pts: [number, number][] = [];
    for (let zz = -TRENCH_Z, j = 0; zz <= TRENCH_Z; zz += 11.5, j++) pts.push([tx + (j % 2 ? 2.2 : -2.2), zz]);
    const posts: Post[] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const [ax, az] = pts[j], [bx, bz] = pts[j + 1];
      const L = Math.hypot(bx - ax, bz - az), sgn = (bz - az) > 0 ? -1 : 1;
      const f = wall(ax, az, bx, bz, 1.5 * sgn, 1.25, 1.0);
      wall(ax, az, bx, bz, -1.5 * sgn, 0.75, 1.2);
      k.box(1.5, 0.06, L, "#5a4632", [(ax + bx) / 2, heightAt((ax + bx) / 2, (az + bz) / 2) + 0.04, (az + bz) / 2], [0, f.a, 0]);
      const n = Math.floor(L / (quality === "mid" ? 1.05 : 1.5));
      for (let b = 0; b < n; b++) {
        const t = (b + 0.5) / n, px = f.mx + (bx - ax) * (t - 0.5), pz = f.mz + (bz - az) * (t - 0.5);
        bags.box(0.55, 0.3, 1.0, b % 3 ? BAG : "#8a7a58", [px, heightAt(px, pz) + 1.22, pz], [0, f.a + (r() - 0.5) * 0.25, 0]);
      }
      if (quality === "mid") for (let b = 1; b < L / 3.2; b++) { const t = b / Math.ceil(L / 3.2), px = ax + (bx - ax) * t + f.nx * 0.95 * sgn, pz = az + (bz - az) * t + f.nz * 0.95 * sgn;
        k.box(0.14, 1.4, 0.14, WOOD, [px, heightAt(px, pz) + 0.6, pz]); }
      posts.push({ x: (ax + bx) / 2 + f.nx * 0.5 * sgn, z: (az + bz) / 2 + f.nz * 0.5 * sgn, trench: ti });
    }
    all.push(posts);
    const wx = tx - 16; // tikanlı məftil, arada keçidlər
    for (let zz = -TRENCH_Z; zz <= TRENCH_Z; zz += 5) {
      if (((zz + TRENCH_Z) / 5) % 14 < 2) continue;
      const y = heightAt(wx, zz);
      wire.box(0.07, 1.3, 0.07, "#3a3026", [wx, y + 0.55, zz], [0, 0, 0.5]).box(0.07, 1.3, 0.07, "#3a3026", [wx, y + 0.55, zz], [0, 0, -0.5]);
      if (((zz + TRENCH_Z + 5) / 5) % 14 >= 2) for (const hy of [0.4, 0.85]) wire.box(0.025, 0.025, 5.1, "#555049", [wx, heightAt(wx, zz + 2.5) + hy, zz + 2.5], [0, 0, (r() - 0.5) * 0.3]);
    }
  });
  for (const l of LINKS) { // birləşdirici səngərlər (səngər içi yollar)
    const steps = Math.ceil((l.x2 - l.x1) / 6);
    for (let s = 0; s < steps; s++) {
      const ax = l.x1 + ((l.x2 - l.x1) * s) / steps, bx = l.x1 + ((l.x2 - l.x1) * (s + 1)) / steps, bend = Math.sin(s * 0.9) * 1.2, bend2 = Math.sin((s + 1) * 0.9) * 1.2;
      wall(ax, l.z + bend, bx, l.z + bend2, 1.4, 0.9, 0.9); wall(ax, l.z + bend, bx, l.z + bend2, -1.4, 0.9, 0.9);
      const mx = (ax + bx) / 2, mz = l.z + (bend + bend2) / 2;
      k.box(1.4, 0.06, 6.3, "#5a4632", [mx, heightAt(mx, mz) + 0.05, mz], [0, Math.atan2(bx - ax, bend2 - bend), 0]);
    }
  }
  for (const m of k.buildAll("trench", vcMat(scene, "vcWorld", 0.05))) { m.isPickable = false; m.receiveShadows = true; m.freezeWorldMatrix(); }
  const bm = bags.build("sandbags", vcMat(scene, "vcWorld", 0.05)); bm.isPickable = false; bm.freezeWorldMatrix();
  const wm = wire.build("wire", vcMat(scene, "vcGun", 0.4)); wm.isPickable = false; wm.freezeWorldMatrix();
  return all;
}

// --- böyük təpəyə çıxan ziqzaq daş yol ---
function buildHillRoad(scene: Scene) {
  const left: Vector3[] = [], right: Vector3[] = [], uvs: Vector2[] = [];
  for (let i = 0; i < hillRoad.length; i++) {
    const p = hillRoad[i], q = hillRoad[Math.min(i + 1, hillRoad.length - 1)], o = hillRoad[Math.max(i - 1, 0)];
    const dx = q.x - o.x, dz = q.z - o.z, n = Math.hypot(dx, dz) || 1, nx = (dz / n) * 2.4, nz = (-dx / n) * 2.4;
    left.push(new Vector3(p.x - nx, heightAt(p.x - nx, p.z - nz) + 0.22, p.z - nz));
    right.push(new Vector3(p.x + nx, heightAt(p.x + nx, p.z + nz) + 0.22, p.z + nz));
  }
  for (const side of [0, 1]) for (let i = 0; i < left.length; i++) uvs.push(new Vector2(side * 1.6, i * 1.4));
  const road = MeshBuilder.CreateRibbon("hillRoad", { pathArray: [left, right], uvs }, scene);
  const m = pbr(scene, "cobble"); m.zOffset = -2;
  road.material = m; road.isPickable = false; road.freezeWorldMatrix();
}

// --- bitki: təpələrdə 2 m ot, ağaclar (palıd, sərv, şam), kolluqlar; dağ yamaclarında meşə ---
function grassClump(scene: Scene) {
  const t = new DynamicTexture("grassTexK", { width: 256, height: 256 }, scene, true), c = t.getContext() as CanvasRenderingContext2D, r = rng(4);
  c.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 95; i++) {
    const x = r() * 256, h = 150 + r() * 106, bend = (r() - 0.5) * 40, g = 70 + r() * 70, dry = r() < 0.35;
    c.strokeStyle = dry ? `rgb(${g * 0.95 | 0},${g * 0.82 | 0},${g * 0.45 | 0})` : `rgb(${g * 0.5 | 0},${g * 0.7 | 0},${g * 0.3 | 0})`; c.lineWidth = 2 + r() * 3;
    c.beginPath(); c.moveTo(x, 256); c.quadraticCurveTo(x + bend * 0.3, 256 - h * 0.5, x + bend, 256 - h); c.stroke();
  }
  t.hasAlpha = true; t.update();
  const m = new StandardMaterial("tallGrassK", scene);
  m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false; m.specularColor = Color3.Black(); m.transparencyMode = 1;
  const card = (ry: number) => { const p = MeshBuilder.CreatePlane("gc", { width: 2.2, height: 2.1 }, scene); p.position.y = 1.05; p.rotation.y = ry; return p; };
  const clump = Mesh.MergeMeshes([card(0), card(Math.PI / 3), card((2 * Math.PI) / 3)], true)!;
  clump.material = m; clump.isPickable = false;
  return clump;
}
function buildVegetation(scene: Scene, quality: Quality) {
  const q = quality === "mid" ? 1.6 : 1, r = rng(17), mat = vcMat(scene, "vcTree", 0);
  // Blender modelləri (tools/blender/flora.py)
  const oak = floraMesh(scene, "oak", mat), cypress = floraMesh(scene, "cypress", mat), pine = floraMesh(scene, "pine_2", mat);
  const bush = floraMesh(scene, "bushDry", mat);
  const clump = grassClump(scene);
  const trees: Matrix[][] = [[], [], []], bushes: Matrix[] = [], grass: Matrix[] = [];
  const C = COMPOUND;
  const blocked = (x: number, z: number) => nearTrench(x, z) || onLink(x, z) || onRoad(x, z) || x > COAST - 35 ||
    FLAT.slice(1).some((f) => Math.hypot(x - f.x, z - f.z) < f.r - 5) || (x > C.x0 - 120 && x < C.x1 + 5 && Math.abs(z) < 290) ||
    HILLS.some((h) => Math.hypot(x - h.x, z - h.z) < (h.big ? 16 : 9)) || (Math.abs(z) < 12 && x < TRENCH_X[0]);
  const hillW = (x: number, z: number) => ridgeAt(x, z) / 8 + HILLS.reduce((a, h) => a + Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * h.s * h.s)), 0);
  for (let i = 0, n = 0; i < 90000 && n < (q > 1 ? 9000 : 3500); i++) { // ot: səngərlər arası təpələrdə sıx
    const x = TRENCH_X[0] + r() * (TRENCH_X[9] - TRENCH_X[0]), z = (r() - 0.5) * 2 * VALLEY;
    if (blocked(x, z) || ridgeAt(x, z) < 2.2) continue;
    const s = 0.8 + r() * 0.5; grass.push(M(x, heightAt(x, z) - 0.1, z, s, r() * 6, s * (0.85 + r() * 0.35))); n++;
  }
  for (let i = 0, n = 0; i < 20000 && n < (q > 1 ? 1800 : 700); i++) { // otlağın biçilməmiş zolaqları
    const x = MEADOW.x0 + r() * (MEADOW.x1 - MEADOW.x0), z = (r() - 0.5) * 2 * (VALLEY - 20);
    if (!kurtulusGrass(x, z) || blocked(x, z)) continue;
    const s = 0.75 + r() * 0.4; grass.push(M(x, heightAt(x, z) - 0.1, z, s, r() * 6, s)); n++;
  }
  for (const h of HILLS) for (let i = 0, n = 0; i < 4000 && n < (q > 1 ? 450 : 180); i++) {
    const a = r() * Math.PI * 2, d = (0.25 + r() * 1.1) * h.s, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    if (blocked(x, z)) continue;
    const s = 0.8 + r() * 0.5; grass.push(M(x, heightAt(x, z) - 0.1, z, s, r() * 6, s)); n++;
  }
  for (let i = 0, n = 0; i < 60000 && n < (q > 1 ? 2000 : 900); i++) { // ağaclar: təpələrdə, dağ yamaclarında; döyüş sahəsində seyrək
    const x = AREA.x0 + r() * (COAST - 40 - AREA.x0), z = (r() - 0.5) * 2 * 560;
    if (blocked(x, z)) continue;
    const slopeZone = Math.abs(z) > VALLEY - 10, w = hillW(x, z), h = heightAt(x, z);
    if (h > 190 || r() > (slopeZone ? 0.75 : x > TRENCH_X[0] - 20 ? w * 0.8 : 0.1 + w)) continue;
    const s = 0.8 + r() * 0.6, t = slopeZone ? (r() < 0.7 ? 2 : 0) : w > 0.5 ? (r() < 0.6 ? 0 : 2) : r() < 0.4 ? 1 : 0;
    trees[t].push(M(x, h - 0.3, z, s, r() * 6, s * (0.9 + r() * 0.3))); n++;
  }
  for (let i = 0, n = 0; i < 60000 && n < (q > 1 ? 2600 : 1100); i++) {
    const x = AREA.x0 + r() * (COAST - 40 - AREA.x0), z = (r() - 0.5) * 2 * (VALLEY + 60);
    if (blocked(x, z) || r() > 0.12 + hillW(x, z)) continue;
    const s = 0.7 + r() * 0.8; bushes.push(M(x, heightAt(x, z) - 0.2, z, s, r() * 6, s)); n++;
  }
  [oak, cypress, pine].forEach((m, i) => scatterChunked(m, trees[i], 160, false, 0, i === 0 ? { mesh: floraMesh(scene, "oak_lo", mat), dist: 140 } : undefined));
  scatterChunked(bush, bushes, 100, false, 220); scatter(clump, grass);
}

// --- mərmi çuxurları ---
function buildCraters(scene: Scene) {
  const d = MeshBuilder.CreateDisc("crater", { radius: 2.6, tessellation: 12 }, scene);
  d.rotation.x = Math.PI / 2; d.bakeCurrentTransformIntoVertices();
  const m = new StandardMaterial("craterMat", scene); m.diffuseColor = new Color3(0.16, 0.13, 0.1); m.specularColor = Color3.Black(); m.zOffset = -3;
  d.material = m;
  const r = rng(23), ms: Matrix[] = [];
  for (let i = 0; i < 300; i++) {
    const x = TRENCH_X[0] - 40 + r() * (COAST - TRENCH_X[0]), z = (r() - 0.5) * (TRENCH_Z * 2 + 40);
    if (nearTrench(x, z, 4)) continue;
    const s = 0.5 + r() * 1.1; ms.push(M(x, heightAt(x, z) + 0.06, z, s, r() * 6, 1));
  }
  scatter(d, ms);
}
