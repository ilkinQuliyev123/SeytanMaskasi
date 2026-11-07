// Qurtuluş Savaşı xəritəsi — dünya. Qərbdə türk kəndi (bizim kazarma), şərqə doğru 100 m-dən bir 10 səngər xətti sahilə qədər,
// səngərlər arası otlu-ağaclı-kollu təpələr, 3 düşmən kazarması, 6 top təpəsi (ən hündüründə böyük top, ora çıxan yol), dəniz.
// Koordinatlar: +x — dənizə (şərq, günəş dənizdən doğur), z — sahil boyu.
import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Texture, Vector2, Vector3, VertexBuffer } from "@babylonjs/core";
import { Grid, heightAt, rng, setGroundSampler } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";
import { environment, pbr, terrainMaterial } from "./materials";
import { scatter, segObs, setGrassFn, tm as M, type Quality } from "./world";

export const COAST = 800; // su xətti təxminən burada
export const TRENCH_X = Array.from({ length: 10 }, (_, i) => -150 + i * 100);
export const TRENCH_Z = 230; // səngərlər z = −230…230
export const VILLAGE = { x: -720, z: 0, r: 120 };
export const OUR_BARRACKS = { x: -690, z: 0 };
export const ENEMY_BARRACKS = [{ x: 100, z: -110 }, { x: 400, z: 120 }, { x: 700, z: -60 }];
export interface Hill { x: number; z: number; h: number; s: number; big?: boolean }
export const HILLS: Hill[] = [
  { x: 330, z: -470, h: 92, s: 95, big: true }, // ən hündür — böyük top
  { x: -60, z: 360, h: 34, s: 48 }, { x: 210, z: 390, h: 38, s: 50 }, { x: 520, z: 360, h: 36, s: 48 },
  { x: 640, z: -380, h: 33, s: 45 }, { x: 30, z: -390, h: 30, s: 45 },
];
/** oyun meydanı: 10 km uzunluq (x, qərbdən dənizə), 5 km en (z). Kənarında dağlar; oyunçu çıxa bilmir */
export const AREA = { x0: -7500, x1: 2500, z0: -2500, z1: 2500 };
// relyef: döyüş sahəsi ətraflı (≈6.5 m), qalan ərazi kobud (25 m); ətraflı yamaq kobud şəbəkənin xətlərinə düşür
const P = { x0: -1300, x1: 900, z0: -1300, z1: 1300 }, LAND_X1 = 900, CELL = 25;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const baseAt = (x: number, z: number) => 3 + 1.4 * Math.sin(x * 0.012 + 0.5) * Math.cos(z * 0.01) + 0.7 * Math.sin(x * 0.029) * Math.sin(z * 0.025 + 1);

/** səngərlər arasındakı təpələr (yerində boşluqlar var ki, keçmək olsun) */
export function ridgeAt(x: number, z: number) {
  if (x < -135 || x > 735 || Math.abs(z) > 300) return 0;
  let r = 0;
  for (let i = 0; i < 9; i++) {
    const dx = x - (-100 + i * 100);
    if (Math.abs(dx) > 40) continue;
    const gate = clamp01(0.55 + 0.6 * Math.sin(z * 0.03 + i * 1.7));
    r += 7 * gate * Math.exp(-(dx * dx) / 288) * clamp01((300 - Math.abs(z)) / 60);
  }
  return r;
}
const FLAT = [{ x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r, r2: VILLAGE.r + 50 }, ...ENEMY_BARRACKS.map((b) => ({ x: b.x, z: b.z, r: 32, r2: 52 }))];
const hillAt = (x: number, z: number) => HILLS.reduce((h, c) => h + c.h * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.s * c.s)), 0);

export function kurtulusRaw(x: number, z: number) {
  let h = baseAt(x, z) + ridgeAt(x, z) + hillAt(x, z);
  const far = clamp01((Math.hypot((x + 300) * 0.8, z) - 1500) / 1800); // döyüşdən uzaqda — böyük yaşıl təpələr
  h += far * (18 * (0.5 + 0.5 * Math.sin(x * 0.0031 + 1.1) * Math.cos(z * 0.0027)) + 9 * Math.sin(x * 0.0083) * Math.sin(z * 0.0071 + 0.6) + 9);
  const e = Math.max(0, AREA.x0 + 380 - x, Math.abs(z) - (AREA.z1 - 380)); // meydanın kənarında dağ silsiləsi
  h += Math.min(190, e * e * 0.0016);
  for (const f of FLAT) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r2) h = lerp(baseAt(f.x, f.z), h, smooth(f.r, f.r2, d)); }
  return lerp(h, -9, smooth(COAST - 40, COAST + 45, x)); // sahil → dəniz dibi
}
const nearTrench = (x: number, z: number, pad = 9) => Math.abs(z) < TRENCH_Z + pad && TRENCH_X.some((t) => Math.abs(x - t) < pad);
/** səngərlər arası birləşdirici səngərlər (yollar): hər boşluqda iki */
export const LINKS = TRENCH_X.slice(0, -1).flatMap((x, i) => [[-140, 120][i % 2], [70, -50][i % 2]].map((z) => ({ x1: x + 2.5, x2: x + 100 - 2.5, z })));
const onLink = (x: number, z: number, pad = 5) => LINKS.some((l) => x > l.x1 - 2 && x < l.x2 + 2 && Math.abs(z - l.z) < pad);
/** böyük təpəyə spiral yol */
const BIG = HILLS[0];
export const hillRoad = Array.from({ length: 140 }, (_, i) => {
  const t = i / 139, a = t * Math.PI * 2.6, r = 170 * (1 - t) + 9;
  return { x: BIG.x + Math.sin(a) * r, z: BIG.z + Math.cos(a) * r };
});
const onRoad = (x: number, z: number, pad = 6) => Math.hypot(x - BIG.x, z - BIG.z) < 190 && hillRoad.some((p) => Math.abs(p.x - x) < pad && Math.abs(p.z - z) < pad);
/** oyunçu hündür otda gizlənir: təpələrin otlu yamacları */
export const kurtulusGrass = (x: number, z: number) => ridgeAt(x, z) > 2.2 && !nearTrench(x, z, 6) && !onLink(x, z, 3);

export interface Post { x: number; z: number; trench: number }
export function buildKurtulus(scene: Scene, quality: Quality) {
  const grid = new Grid(), anchors: Vector3[] = [];
  // --- relyef: kobud (bütün meydan) + ətraflı yamaq (döyüş sahəsi) ---
  const r0 = rng(7);
  const colorAt = (x: number, z: number, h: number) => {
    const slope = Math.abs(kurtulusRaw(x + 4, z) - h) + Math.abs(kurtulusRaw(x, z + 4) - h);
    const rock = clamp01(Math.max((slope - 3.2) / 4, (h - 110) / 40));
    const meadow = clamp01(0.55 + 0.45 * Math.sin(x * 0.017 + 1) * Math.cos(z * 0.013) + (r0() - 0.5) * 0.25);
    let c = [(1 - rock) * (1 - meadow) * 0.6, (1 - rock) * meadow, rock];
    if (x > COAST - 45) c = [0, 0.05 * (1 - clamp01((x - COAST + 45) / 30)), 0.12]; // qumlu sahil (torpaq)
    else if (nearTrench(x, z, 10) || onLink(x, z, 4)) c = [0.05, 0.12, 0.02]; // səngər ətrafı — eşilmiş torpaq
    else if (x > TRENCH_X[0] - 30 && x < COAST - 40 && Math.abs(z) < TRENCH_Z + 20 && ridgeAt(x, z) < 1.2) c = [c[0] * 0.5, c[1] * 0.45, c[2]]; // döyüş sahəsi — çox torpaq
    for (const f of FLAT) if (Math.hypot(x - f.x, z - f.z) < f.r - 8) c = [0.05, 0.25, 0.02];
    return c;
  };
  const makeGround = (name: string, x0: number, x1: number, z0: number, z1: number, sx: number, sz: number, hole: boolean) => {
    const g = MeshBuilder.CreateGround(name, { width: x1 - x0, height: z1 - z0, subdivisionsX: sx, subdivisionsY: sz, updatable: true }, scene);
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = g.getVerticesData(VertexBuffer.PositionKind)!, col: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] + g.position.x, z = pos[i + 2] + g.position.z, h = kurtulusRaw(x, z);
      const inside = hole && x > P.x0 + 1 && x < P.x1 - 1 && z > P.z0 + 1 && z < P.z1 - 1; // ətraflı yamağın altında — gizlənir
      pos[i + 1] = inside ? h - 4 : h;
      const c = colorAt(x, z, h); col.push(c[0], c[1], c[2], 1);
    }
    g.updateVerticesData(VertexBuffer.PositionKind, pos); g.setVerticesData(VertexBuffer.ColorKind, col);
    g.createNormals(false); g.updateCoordinateHeights();
    g.isPickable = false; g.receiveShadows = true; g.freezeWorldMatrix();
    return g;
  };
  const ground = makeGround("ground", P.x0, P.x1, P.z0, P.z1, quality === "mid" ? 420 : 340, quality === "mid" ? 360 : 290, false);
  const coarse = makeGround("groundFar", AREA.x0, LAND_X1, AREA.z0, AREA.z1, (LAND_X1 - AREA.x0) / CELL, (AREA.z1 - AREA.z0) / CELL, true);
  setGroundSampler((x, z) => (x > LAND_X1 - 6 ? -9 : x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1 ? ground.getHeightAtCoordinates(x, z) : coarse.getHeightAtCoordinates(x, z)));
  setGrassFn(kurtulusGrass);
  const env = environment(scene); env.level = 0.6;
  ground.material = coarse.material = terrainMaterial(scene);

  const sea = buildSea(scene);
  buildVillage(scene, grid, anchors);
  ENEMY_BARRACKS.forEach((b, i) => buildEnemyBarracks(scene, grid, b.x, b.z, i));
  const posts = buildTrenches(scene, quality);
  buildHillRoad(scene);
  buildVegetation(scene, quality);
  buildCraters(scene);
  return { ground, grid, anchors, posts, sea };
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
  return { mesh: sea, tex: t };
}

const STONE = "#b8ab8f", PLASTER = "#e2d6bf", WOOD = "#4a3020", TILE = "#8e4a2e", EARTH = "#5b4a36", BAG = "#9a8a64";
const TM: Record<string, [string, string]> = { [STONE]: ["sandstone", "#e0d4bc"], [PLASTER]: ["plaster", "#ffffff"], [WOOD]: ["cedar", "#6a4a34"], [TILE]: ["roof", "#ffffff"], [EARTH]: ["dirt", "#b49a7c"] };
function rect(g: Grid, x: number, z: number, w: number, d: number, rot: number) { // fırlanmış düzbucaqlı → dairələr
  const c = Math.cos(rot), s = Math.sin(rot), long = d > w, L = Math.max(w, d), r = Math.min(w, d) / 2;
  const ax = long ? s : c, az = long ? c : -s, h = L / 2 - r;
  segObs(g, x - ax * h, z - az * h, x + ax * h, z + az * h, r + 0.2);
}

// --- bizim kənd: daş evlər, kirəmit damlar, məscid, uzun kazarma (döyüşə buradan çıxırıq) ---
function buildVillage(scene: Scene, grid: Grid, anchors: Vector3[]) {
  const k = new Kit(scene), glow = new Kit(scene), r = rng(9);
  k.texMap = TM;
  const y0 = heightAt(VILLAGE.x, VILLAGE.z);
  const house = (x: number, z: number, w: number, d: number, rot: number, floors = 1) => {
    const y = heightAt(x, z) - 0.3, H = 3.2 * floors, R: [number, number, number] = [0, rot, 0];
    k.box(w, H, d, floors > 1 ? PLASTER : STONE, [x, y + H / 2, z], R).box(w + 0.3, 0.5, d + 0.3, STONE, [x, y + 0.25, z], R)
      .roof(w + 1.2, d + 1.2, 1.7, TILE, [x, y + H + 0.85, z], rot, 0.3)
      .box(1, 2, 0.12, WOOD, [x + Math.sin(rot) * (d / 2 + 0.03), y + 1, z + Math.cos(rot) * (d / 2 + 0.03)], R);
    if (r() < 0.5) glow.box(0.7, 0.7, 0.1, "#ffffff", [x + Math.sin(rot) * (d / 2 + 0.06) + Math.cos(rot) * 1.6, y + 2, z + Math.cos(rot) * (d / 2 + 0.06) - Math.sin(rot) * 1.6], R);
    rect(grid, x, z, w, d, rot);
  };
  // kazarma: 50×14 m, qapısı şərqə (döyüşə) baxır; qarşısında həyət
  const B = OUR_BARRACKS, by = heightAt(B.x, B.z) - 0.3;
  k.box(14, 5, 50, STONE, [B.x, by + 2.5, B.z]).roof(15.5, 51.5, 2.6, TILE, [B.x, by + 6.3, B.z], 0, 0.15);
  for (let i = -3; i <= 3; i++) glow.box(0.1, 1, 1.6, "#ffffff", [B.x + 7.06, by + 2.6, B.z + i * 6.5]);
  k.box(0.15, 3.2, 3.6, WOOD, [B.x + 7.05, by + 1.6, B.z]);
  k.box(1.2, 9, 1.2, WOOD, [B.x + 12, by + 4.5, B.z - 9]); // bayraq dirəyi
  const flag = new Kit(scene); flag.box(0.05, 2.2, 3.4, "#c8102e", [B.x + 12, by + 8, B.z - 7.2]);
  flag.build("flag", vcMat(scene, "vcFlag", 0.1)).isPickable = false;
  const fw = new Kit(scene); fw.cyl(0.05, 0.7, 0.7, "#ffffff", [B.x + 12.03, by + 8.1, B.z - 7.4], [0, 0, Math.PI / 2], 14).cyl(0.06, 0.6, 0.6, "#c8102e", [B.x + 12.04, by + 8.1, B.z - 7.25], [0, 0, Math.PI / 2], 14)
    .box(0.06, 0.25, 0.25, "#ffffff", [B.x + 12.05, by + 8.1, B.z - 6.75], [Math.PI / 4, 0, 0]); // ay-ulduz
  fw.build("flagSign", vcMat(scene, "vcFlag", 0.1)).isPickable = false;
  rect(grid, B.x, B.z, 14, 50, 0);
  anchors.push(new Vector3(B.x + 8, by + 3, B.z));
  // məscid: kub, günbəz, minarə
  const mx = VILLAGE.x - 60, mz = VILLAGE.z + 55, my = heightAt(mx, mz) - 0.3;
  k.box(13, 8, 13, STONE, [mx, my + 4, mz]).sph(10, "#8a8f96", [mx, my + 8, mz], [1, 0.9, 1], 10, 0.5)
    .cyl(24, 1.6, 2, STONE, [mx + 8, my + 12, mz + 6], undefined, 10).cyl(0.6, 2.6, 2.6, STONE, [mx + 8, my + 19, mz + 6], undefined, 10)
    .cyl(4, 0, 1.8, "#8a8f96", [mx + 8, my + 26, mz + 6], undefined, 10);
  rect(grid, mx, mz, 13, 13, 0); grid.add({ x: mx + 8, z: mz + 6, r: 1.3 });
  anchors.push(new Vector3(mx, my + 4, mz - 8));
  // evlər: iki halqa; şərq yolu və kazarma həyəti boş qalır
  for (const [rad, n] of [[42, 12], [75, 18], [105, 22]] as const) for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.2, x = VILLAGE.x + Math.sin(a) * rad, z = VILLAGE.z + Math.cos(a) * rad;
    if (Math.abs(z - VILLAGE.z) < 14 && x > VILLAGE.x - 10) continue; // şərq yolu
    if (Math.abs(x - B.x) < 30 && Math.abs(z - B.z) < 36) continue; // kazarma + həyət
    if (Math.hypot(x - mx, z - mz) < 18) continue;
    house(x, z, 6 + r() * 3, 5 + r() * 2.5, a + Math.PI, r() < 0.3 ? 2 : 1);
  }
  // daş hasar + quyu
  k.cyl(1, 2.4, 2.6, STONE, [VILLAGE.x - 20, y0 + 0.2, VILLAGE.z - 30], undefined, 10); grid.add({ x: VILLAGE.x - 20, z: VILLAGE.z - 30, r: 1.4 });
  for (const m of k.buildAll("village", vcMat(scene, "vcWorld", 0.05))) m.metadata = { solid: true };
  glow.build("villageGlow", glowMat(scene, "#ffb35a")).isPickable = false;
}

// --- düşmən kazarması: uzun bina, çadırlar, qum torbası halqası ---
function buildEnemyBarracks(scene: Scene, grid: Grid, x: number, z: number, i: number) {
  const k = new Kit(scene), y = heightAt(x, z) - 0.3, r = rng(30 + i);
  k.texMap = TM;
  k.box(12, 4.6, 40, PLASTER, [x, y + 2.3, z]).roof(13.4, 41.4, 2.2, TILE, [x, y + 5.7, z], 0, 0.15);
  for (let j = -2; j <= 2; j++) k.box(0.12, 1, 1.5, "#2a2a2a", [x - 6.05, y + 2.6, z + j * 7]);
  rect(grid, x, z, 12, 40, 0);
  for (let j = 0; j < 6; j++) { // çadırlar
    const tx = x + 14 + (j % 2) * 8, tz = z - 18 + Math.floor(j / 2) * 15, ty = heightAt(tx, tz);
    k.cyl(3, 0.2, 5.6, "#8a8468", [tx, ty + 1.5, tz], [0, r() * 0.3 + Math.PI / 4, 0], 4);
    grid.add({ x: tx, z: tz, r: 2.4 });
  }
  for (let j = 0; j < 40; j++) { // qum torbası halqası
    const a = (j / 40) * Math.PI * 2, bx = x + Math.sin(a) * 30, bz = z + Math.cos(a) * 30;
    if (Math.abs(Math.sin(a)) > 0.95) continue; // şərq-qərb keçidləri
    k.box(1.4, 0.9, 0.6, BAG, [bx, heightAt(bx, bz) + 0.4, bz], [0, a + Math.PI / 2, 0]);
  }
  for (const m of k.buildAll("enemyBarracks" + i, vcMat(scene, "vcWorld", 0.05))) m.metadata = { solid: true };
}

// --- 10 səngər xətti: ziqzaq, qabaqda qum torbalı parapet, arxada alçaq torpaq tökmə, dirəklər, taxta döşəmə; qabaqda tikanlı məftil ---
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
      const L = Math.hypot(bx - ax, bz - az), sgn = (bz - az) > 0 ? -1 : 1; // qabaq (qərb) tərəf
      const f = wall(ax, az, bx, bz, 1.5 * sgn, 1.25, 1.0);
      wall(ax, az, bx, bz, -1.5 * sgn, 0.75, 1.2);
      k.box(1.5, 0.06, L, "#5a4632", [(ax + bx) / 2, heightAt((ax + bx) / 2, (az + bz) / 2) + 0.04, (az + bz) / 2], [0, f.a, 0]); // taxta döşəmə
      const n = Math.floor(L / (quality === "mid" ? 1.05 : 1.4));
      for (let b = 0; b < n; b++) { // qum torbaları parapetin üstündə
        const t = (b + 0.5) / n, px = f.mx + (bx - ax) * (t - 0.5), pz = f.mz + (bz - az) * (t - 0.5);
        bags.box(0.55, 0.3, 1.0, b % 3 ? BAG : "#8a7a58", [px, heightAt(px, pz) + 1.22, pz], [0, f.a + (r() - 0.5) * 0.25, 0]);
      }
      for (let b = 1; b < L / 3.2; b++) { const t = b / Math.ceil(L / 3.2), px = ax + (bx - ax) * t + f.nx * 0.95 * sgn, pz = az + (bz - az) * t + f.nz * 0.95 * sgn;
        k.box(0.14, 1.4, 0.14, WOOD, [px, heightAt(px, pz) + 0.6, pz]); }
      posts.push({ x: (ax + bx) / 2 + f.nx * 0.5 * sgn, z: (az + bz) / 2 + f.nz * 0.5 * sgn, trench: ti });
    }
    all.push(posts);
    // tikanlı məftil: səngərdən 14 m qabaqda, arada keçidlər
    const wx = tx - 14;
    for (let zz = -TRENCH_Z; zz <= TRENCH_Z; zz += 5) {
      if (((zz + TRENCH_Z) / 5) % 14 < 2) continue; // keçid
      const y = heightAt(wx, zz);
      wire.box(0.07, 1.3, 0.07, "#3a3026", [wx, y + 0.55, zz], [0, 0, 0.5]).box(0.07, 1.3, 0.07, "#3a3026", [wx, y + 0.55, zz], [0, 0, -0.5]);
      if (((zz + TRENCH_Z + 5) / 5) % 14 >= 2) for (const hy of [0.4, 0.85]) wire.box(0.025, 0.025, 5.1, "#555049", [wx, heightAt(wx, zz + 2.5) + hy, zz + 2.5], [0, 0, (r() - 0.5) * 0.3]);
    }
  });
  // birləşdirici səngərlər (səngər içi yollar): iki yanında torpaq tökmə, altında taxta yol
  for (const l of LINKS) {
    const steps = Math.ceil((l.x2 - l.x1) / 6);
    for (let s = 0; s < steps; s++) {
      const ax = l.x1 + ((l.x2 - l.x1) * s) / steps, bx = l.x1 + ((l.x2 - l.x1) * (s + 1)) / steps, bend = Math.sin(s * 0.9) * 1.2, bend2 = Math.sin((s + 1) * 0.9) * 1.2;
      wall(ax, l.z + bend, bx, l.z + bend2, 1.4, 0.9, 0.9); wall(ax, l.z + bend, bx, l.z + bend2, -1.4, 0.9, 0.9);
      const mx = (ax + bx) / 2, mz = l.z + (bend + bend2) / 2;
      k.box(1.4, 0.06, 6.3, "#5a4632", [mx, heightAt(mx, mz) + 0.05, mz], [0, Math.atan2(bx - ax, bend2 - bend), 0]);
    }
  }
  for (const m of k.buildAll("trench", vcMat(scene, "vcWorld", 0.05))) { m.isPickable = false; m.receiveShadows = true; }
  bags.build("sandbags", vcMat(scene, "vcWorld", 0.05)).isPickable = false;
  wire.build("wire", vcMat(scene, "vcGun", 0.4)).isPickable = false;
  return all;
}

// --- böyük təpəyə çıxan torpaq yol ---
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
  road.material = m; road.isPickable = false;
}

// --- bitki: təpələrdə 2 m ot, ağaclar (palıd, sərv, şam), kolluqlar ---
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
  const q = quality === "mid" ? 1.7 : 1, r = rng(17), mat = vcMat(scene, "vcTree", 0);
  const tk = () => Object.assign(new Kit(scene), { texMap: { "#3b2a1c": ["bark", "#9a8a7a"] } as Record<string, [string, string]> });
  const oak = tk().cyl(3, 0.4, 0.6, "#3b2a1c", [0, 1.5, 0], undefined, 5).sph(5.5, "#3a5428", [0, 5, 0], [1, 0.8, 1], 4).sph(3.6, "#46602e", [1, 6.2, 0.6], undefined, 3).buildAll("oak", mat);
  const cypress = tk().cyl(2, 0.3, 0.4, "#3b2a1c", [0, 1, 0], undefined, 5).cyl(10, 0.2, 2.2, "#1f3a22", [0, 6.5, 0], undefined, 7).buildAll("cypress", mat);
  const pine = tk().cyl(3, 0.35, 0.5, "#3b2a1c", [0, 1.5, 0], undefined, 5).cyl(5, 0, 4, "#1d3a24", [0, 5, 0], undefined, 6).cyl(4, 0, 2.8, "#22432a", [0, 7.6, 0], undefined, 6).buildAll("pineK", mat);
  const bushK = new Kit(scene); bushK.sph(1.8, "#3a4a22", [0, 0.6, 0], [1.2, 0.75, 1], 4).sph(1.3, "#4a5a2a", [0.6, 0.8, 0.3], undefined, 3).sph(1.2, "#334420", [-0.5, 0.7, -0.4], undefined, 3);
  const bush = bushK.build("bush", mat); bush.isPickable = false;
  const clump = grassClump(scene);
  const trees: Matrix[][] = [[], [], []], bushes: Matrix[] = [], grass: Matrix[] = [];
  const blocked = (x: number, z: number) => nearTrench(x, z) || onLink(x, z) || onRoad(x, z) || x > COAST - 35 ||
    FLAT.some((f) => Math.hypot(x - f.x, z - f.z) < f.r - 5) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 10 ||
    HILLS.some((h) => Math.hypot(x - h.x, z - h.z) < (h.big ? 16 : 9)); // top meydançaları açıq
  const hillW = (x: number, z: number) => ridgeAt(x, z) / 7 + HILLS.reduce((a, h) => a + Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * h.s * h.s)), 0);
  // ot: təpələrdə sıx
  for (let i = 0, n = 0; i < 90000 && n < 9000 * q; i++) {
    const x = -140 + r() * 880, z = (r() - 0.5) * 620;
    if (blocked(x, z) || ridgeAt(x, z) < 2.0) continue;
    const s = 0.8 + r() * 0.5; grass.push(M(x, heightAt(x, z) - 0.1, z, s, r() * 6, s * (0.85 + r() * 0.35))); n++;
  }
  for (const h of HILLS) for (let i = 0, n = 0; i < 4000 && n < 550 * q; i++) { // top təpələrinin yamacları
    const a = r() * Math.PI * 2, d = (0.25 + r() * 1.2) * h.s, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    if (blocked(x, z)) continue;
    const s = 0.8 + r() * 0.5; grass.push(M(x, heightAt(x, z) - 0.1, z, s, r() * 6, s)); n++;
  }
  // ağaclar və kollar: təpələrdə çox, düzənlikdə seyrək, kəndin ətrafında bağlar
  for (let i = 0, n = 0; i < 60000 && n < 1300 * q; i++) {
    const x = -1250 + r() * 2030, z = (r() - 0.5) * 2300;
    if (blocked(x, z)) continue;
    const w = hillW(x, z), battle = x > -170 && x < COAST && Math.abs(z) < TRENCH_Z + 30;
    if (r() > (battle ? w * 0.9 : 0.12 + w)) continue;
    const s = 0.8 + r() * 0.6, t = w > 0.5 ? (r() < 0.6 ? 0 : 2) : r() < 0.4 ? 1 : r() < 0.7 ? 0 : 2;
    trees[t].push(M(x, heightAt(x, z) - 0.3, z, s, r() * 6, s * (0.9 + r() * 0.3))); n++;
  }
  // uzaq kənd yerləri: meşə ləkələri (5×10 km meydanın hamısında)
  const forestAt = (x: number, z: number) => Math.sin(x * 0.0021 + 0.4) * Math.cos(z * 0.0026 + 1.3) + 0.5 * Math.sin(x * 0.0057) * Math.sin(z * 0.0049 + 2);
  for (let i = 0, n = 0; i < 80000 && n < 2600 * q; i++) {
    const x = AREA.x0 + 60 + r() * (LAND_X1 - AREA.x0 - 200), z = AREA.z0 + 60 + r() * (AREA.z1 - AREA.z0 - 120);
    if (x > -1300 && x < 900 && Math.abs(z) < 1300) continue; // döyüş sahəsi yuxarıda
    if (forestAt(x, z) < 0.35 || heightAt(x, z) > 150) continue;
    const s = 0.9 + r() * 0.7; trees[r() < 0.55 ? 2 : r() < 0.6 ? 0 : 1].push(M(x, heightAt(x, z) - 0.3, z, s, r() * 6, s * (0.9 + r() * 0.4))); n++;
  }
  for (let i = 0, n = 0; i < 60000 && n < 2600 * q; i++) {
    const x = -400 + r() * 1180, z = (r() - 0.5) * 1100;
    if (blocked(x, z) || r() > 0.15 + hillW(x, z)) continue;
    const s = 0.7 + r() * 0.8; bushes.push(M(x, heightAt(x, z) - 0.2, z, s, r() * 6, s)); n++;
  }
  [oak, cypress, pine].forEach((ms, i) => ms.forEach((m) => scatter(m, trees[i])));
  scatter(bush, bushes); scatter(clump, grass);
}

// --- mərmi çuxurları (döyüş sahəsi) ---
function buildCraters(scene: Scene) {
  const d = MeshBuilder.CreateDisc("crater", { radius: 2.6, tessellation: 12 }, scene);
  d.rotation.x = Math.PI / 2; d.bakeCurrentTransformIntoVertices();
  const m = new StandardMaterial("craterMat", scene); m.diffuseColor = new Color3(0.16, 0.13, 0.1); m.specularColor = Color3.Black(); m.zOffset = -3;
  d.material = m;
  const r = rng(23), ms: Matrix[] = [];
  for (let i = 0; i < 260; i++) {
    const x = TRENCH_X[0] - 40 + r() * (COAST - TRENCH_X[0]), z = (r() - 0.5) * (TRENCH_Z * 2 + 40);
    if (nearTrench(x, z, 4)) continue;
    const s = 0.5 + r() * 1.1; ms.push(M(x, heightAt(x, z) + 0.06, z, s, r() * 6, 1));
  }
  scatter(d, ms);
}
