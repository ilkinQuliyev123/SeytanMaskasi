// Dünya: 2.6 km relyef, 4 dağ, yollar, sıx meşə, mərkəzdə yapon saray kompleksi (dojo zalı, gölməçə, fənərlər).
import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector2, Vector3, VertexBuffer } from "@babylonjs/core";
import { rawHeight, setGroundSampler, Grid, HALF, HAMLETS, heightAt, hillsAt, NORTH, northAt, rng, roadCoords, roadPoint, SITES, townLayout, type Site } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";
import { environment, pbr, terrainMaterial } from "./materials";

export type Quality = "low" | "mid";
const M = (x: number, y: number, z: number, s = 1, ry = 0, sy = s) =>
  Matrix.Compose(new Vector3(s, sy, s), Quaternion.RotationAxis(Vector3.Up(), ry), new Vector3(x, y, z));

/** thin instances: bir model, çox nüsxə (çox ucuz) */
export function scatter(mesh: Mesh, ms: Matrix[], pickable = false) {
  const buf = new Float32Array(ms.length * 16);
  ms.forEach((m, i) => m.copyToArray(buf, i * 16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
  mesh.isPickable = pickable;
  if (pickable) { mesh.thinInstanceEnablePicking = true; mesh.metadata = { solid: true }; }
  return mesh;
}
export { M as tm };

/** düz xətt boyunca dairəvi maneələr (divar və s.) */
export function segObs(g: Grid, x1: number, z1: number, x2: number, z2: number, r = 0.9) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (r * 1.4)));
  for (let i = 0; i <= n; i++) g.add({ x: x1 + ((x2 - x1) * i) / n, z: z1 + ((z2 - z1) * i) / n, r });
}
function rectObs(g: Grid, x: number, z: number, w: number, d: number) {
  const r = Math.min(w, d) / 2, long = w > d;
  segObs(g, long ? x - w / 2 + r : x, long ? z : z - d / 2 + r, long ? x + w / 2 - r : x, long ? z : z + d / 2 - r, r);
}

function roadOf(scene: Scene, st: Site) {
  const L = Math.hypot(st.x, st.z) - st.R + 16, left: Vector3[] = [], right: Vector3[] = [];
  for (let s = 40; s <= L; s += 8) {
    const p = roadPoint(st, s), q = roadPoint(st, s + 1), dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz);
    const w = s > L - 60 ? 6 : 3.5; // darvazaya yaxın — geniş daş yol
    const nx = (dz / n) * w, nz = (-dx / n) * w;
    left.push(new Vector3(p.x - nx, heightAt(p.x - nx, p.z - nz) + 0.25, p.z - nz));
    right.push(new Vector3(p.x + nx, heightAt(p.x + nx, p.z + nz) + 0.25, p.z + nz));
  }
  const uvs: Vector2[] = [];
  for (const side of [0, 1]) for (let i = 0; i < left.length; i++) uvs.push(new Vector2(side * 2.3, (i * 8) / 3));
  const r = MeshBuilder.CreateRibbon("road", { pathArray: [left, right], uvs }, scene);
  r.isPickable = false;
  return r;
}

export function buildWorld(scene: Scene, quality: Quality) {
  const grid = new Grid(), anchors: Vector3[] = [];
  setGrassFn(null);
  // relyef — vertex rəngləri: meşə torpağı, qaya, qəsr ətrafı torpaq, saray həyəti
  const ground = MeshBuilder.CreateGround("ground", { width: HALF * 2, height: HALF * 2, subdivisions: 256, updatable: true }, scene);
  const pos = ground.getVerticesData(VertexBuffer.PositionKind)!, col: number[] = [];
  const r0 = rng(3);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2], h = rawHeight(x, z);
    pos[i + 1] = h;
    // toxuma çəkiləri: r — meşə torpağı, g — ot, b — qaya; qalanı (1 − cəm) — torpaq
    const slope = Math.abs(heightAt(x + 4, z) - h) + Math.abs(heightAt(x, z + 4) - h);
    const rock = Math.min(1, Math.max(0, (slope - 3) / 4, (h - 70) / 20));
    const meadow = 0.5 + 0.5 * Math.sin(x * 0.013 + 1) * Math.cos(z * 0.011) + (r0() - 0.5) * 0.2;
    let c = [(1 - rock) * (1 - meadow), (1 - rock) * meadow, rock];
    if (SITES.some((s) => Math.hypot(x - s.x, z - s.z) < s.R + 50) || (Math.abs(x) < 42 && z > -36 && z < 38)) c = [0.1, 0.05, 0];
    col.push(c[0], c[1], Math.max(0, c[2]), 1);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, pos);
  ground.setVerticesData(VertexBuffer.ColorKind, col);
  ground.createNormals(false);
  ground.updateCoordinateHeights();
  setGroundSampler((x, z) => ground.getHeightAtCoordinates(x, z)); // obyektlər çəkilən səthə oturur
  environment(scene);
  ground.material = terrainMaterial(scene);
  ground.isPickable = false;
  ground.receiveShadows = true;
  ground.freezeWorldMatrix();

  const roadMat = pbr(scene, "cobble");
  roadMat.zOffset = -2;
  for (const st of SITES) roadOf(scene, st).material = roadMat;

  buildPalace(scene, grid, anchors);
  buildHamlets(scene, grid, anchors);
  buildTown(scene, grid, anchors);
  buildForest(scene, quality);
  return { ground, grid, anchors };
}

// --- meşə: şam/sidr, yarpaqlı ağac, payız ağcaqayını ---
function buildForest(scene: Scene, quality: Quality) {
  const mat = vcMat(scene, "vcTree", 0);
  const tk = () => Object.assign(new Kit(scene), { texMap: { "#3b2a1c": ["bark", "#9a8a7a"] } as Record<string, [string, string]> });
  const pine = tk().cyl(3, 0.35, 0.5, "#3b2a1c", [0, 1.5, 0], undefined, 5)
    .cyl(5, 0, 4, "#16331f", [0, 5, 0], undefined, 6).cyl(4, 0, 2.8, "#1b3d25", [0, 7.6, 0], undefined, 6).buildAll("pine", mat);
  const broad = tk().cyl(3, 0.35, 0.5, "#3b2a1c", [0, 1.5, 0], undefined, 5)
    .sph(5, "#24502a", [0, 5, 0], [1, 0.85, 1], 4).sph(3.4, "#2c5e30", [0.9, 6.3, 0.4], undefined, 3).buildAll("broad", mat);
  const maple = tk().cyl(2.6, 0.3, 0.45, "#3b2a1c", [0, 1.3, 0], undefined, 5)
    .sph(4.4, "#b8501c", [0, 4.4, 0], [1, 0.8, 1], 4).sph(3, "#d0802a", [-0.8, 5.4, 0.5], undefined, 3).buildAll("maple", mat);
  const k = quality === "mid" ? 1.6 : 1, r = rng(11), lists: Matrix[][] = [[], [], []];
  const free = (x: number, z: number) => {
    if (Math.abs(x) < 50 && z > -44 && z < 46) return false;
    if (Math.abs(x) < 9 && z > 40 && z < 70) return false;
    if (HAMLETS.some((v) => Math.hypot(x - v.x, z - v.z) < v.r + 22)) return false;
    { const { s, lat } = roadCoords(SITES[0], x, z); if (s > NORTH.hay[0] - 4 && s < NORTH.town[1] + 10 && Math.abs(lat) < NORTH.halfW + 25) return false; } // samanlıq + məhəllə
    for (const st of SITES) {
      if (Math.hypot(x - st.x, z - st.z) < st.R + 62) return false;
      const { s, lat, L } = roadCoords(st, x, z);
      if (s > 20 && s < L && Math.abs(lat) < 10) return false;
    }
    return heightAt(x, z) < 95;
  };
  const place = (n: number, span: number, near: number) => {
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const x = (r() - 0.5) * span, z = (r() - 0.5) * span;
      if (!free(x, z)) continue;
      const t = Math.hypot(x, z) < near ? (r() < 0.25 ? 2 : r() < 0.5 ? 1 : 0) : r() < 0.7 ? 0 : 1;
      const s = 0.8 + r() * 0.7;
      lists[t].push(M(x, heightAt(x, z) - 0.2, z, s, r() * 6, s * (0.9 + r() * 0.4)));
      n--;
    }
  };
  place(2600 * k, 1500, 180);
  for (let i = 0, n = 0; i < 9000 && n < 1500 * k; i++) { // keçiddən sonra 200 m SIX meşə (yolun iki tərəfi)
    const s = NORTH.forest[0] + r() * (NORTH.forest[1] - NORTH.forest[0]), lat = (r() < 0.5 ? -1 : 1) * (8 + r() * 160), p = northAt(s, lat);
    if (!free(p.x, p.z)) continue;
    const sc = 0.9 + r() * 0.8; lists[r() < 0.75 ? 0 : 1].push(M(p.x, heightAt(p.x, p.z) - 0.2, p.z, sc, r() * 6, sc * (1 + r() * 0.5))); n++;
  }
  place(1300 * k, HALF * 2 - 120, 0);
  [pine, broad, maple].forEach((ms, i) => ms.forEach((m) => scatter(m, lists[i])));
}

/** 2 m hündür sıx ot zolağı: çarpaz kartlar + prosedur ot toxuması (alfa), külək ilə yellənir */
const palaceGrass = (x: number, z: number) => { const { s, lat } = roadCoords(SITES[0], x, z); return s > NORTH.hay[0] && s < NORTH.hay[1] && Math.abs(lat) > 4 && Math.abs(lat) < NORTH.halfW * 1.6; };
let grassFn = palaceGrass;
/** hündür otun içindədirmi (hər xəritə özününkünü qoyur) */
export const setGrassFn = (f: ((x: number, z: number) => boolean) | null) => (grassFn = f ?? palaceGrass);
export const inTallGrass = (x: number, z: number) => grassFn(x, z);
function tallGrass(scene: Scene) {
  const t = new DynamicTexture("grassTex", { width: 256, height: 256 }, scene, true), c = t.getContext() as CanvasRenderingContext2D, r = rng(4);
  c.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { // ot yarpaqları
    const x = r() * 256, h = 150 + r() * 106, bend = (r() - 0.5) * 40, g = 70 + r() * 70;
    c.strokeStyle = `rgb(${g * 0.5 | 0},${g * 0.72 | 0},${g * 0.3 | 0})`; c.lineWidth = 2 + r() * 3;
    c.beginPath(); c.moveTo(x, 256); c.quadraticCurveTo(x + bend * 0.3, 256 - h * 0.5, x + bend, 256 - h); c.stroke();
  }
  t.hasAlpha = true; t.update();
  const m = new StandardMaterial("tallGrass", scene);
  m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false; m.specularColor = Color3.Black();
  m.diffuseTexture.hasAlpha = true; m.transparencyMode = 1; // alpha test — ucuz
  const card = (ry: number) => { const p = MeshBuilder.CreatePlane("gc", { width: 2.2, height: 2.1 }, scene); p.position.y = 1.05; p.rotation.y = ry; return p; };
  const clump = Mesh.MergeMeshes([card(0), card(Math.PI / 3), card((2 * Math.PI) / 3)], true)!;
  clump.material = m; clump.isPickable = false;
  const ms: Matrix[] = [], rr = rng(21);
  for (let i = 0; i < 5200; i++) {
    const s = NORTH.hay[0] + rr() * (NORTH.hay[1] - NORTH.hay[0]), lat = (rr() - 0.5) * NORTH.halfW * 3.2;
    if (Math.abs(lat) < 4) continue; // yol açıq
    const p = northAt(s, lat), sc = 0.8 + rr() * 0.45;
    ms.push(M(p.x, heightAt(p.x, p.z) - 0.1, p.z, sc, rr() * 6, sc * (0.85 + rr() * 0.3)));
  }
  scatter(clump, ms);
}

// --- samanlıq (meşənin bitdiyi yer) + 500 m labirint Osmanlı məhəlləsi ---
function buildTown(scene: Scene, grid: Grid, anchors: Vector3[]) {
  tallGrass(scene);

  const T = townLayout(), k = new Kit(scene), roofs = new Kit(scene), glow = new Kit(scene);
  const tm: Record<string, [string, string]> = { "#a8977c": ["sandstone", "#d8ccb4"], "#e2d6bf": ["plaster", "#ffffff"], "#4a3020": ["cedar", "#6a4a34"], "#8e4a2e": ["roof", "#ffffff"] };
  k.texMap = tm; roofs.texMap = tm;
  let i = 0;
  for (const h of T.houses) {
    const p = northAt(h.s, h.lat), y = heightAt(p.x, p.z) - 0.4, tall = (i++ * 7) % 3 !== 0, w = T.u - 0.4, d = h.len - 0.6;
    k.box(w, 3.4, d, "#a8977c", [p.x, y + 1.7, p.z]);
    if (tall) k.box(w + 0.7, 2.6, d + 0.5, "#e2d6bf", [p.x, y + 4.7, p.z]).box(w + 0.75, 0.15, d + 0.55, "#4a3020", [p.x, y + 3.45, p.z]);
    roofs.roof(w + 1.3, d + 1.1, 1.6, "#8e4a2e", [p.x, y + (tall ? 6 : 3.4) + 0.8, p.z], 0, 0.3);
    if (i % 4 === 0) glow.box(0.1, 0.8, 1, "#ffffff", [p.x + (h.lat < 0 ? 1 : -1) * (w / 2 + (tall ? 0.4 : 0.05)), y + (tall ? 4.6 : 1.8), p.z]);
    for (let t = -d / 2 + 2.5; t <= d / 2 - 2.4; t += 4.6) grid.add({ x: p.x, z: p.z + t, r: 2.7 });
    if (d < 5) grid.add({ x: p.x, z: p.z, r: 2.7 });
  }
  for (let s = NORTH.town[0] + 20; s < NORTH.town[1]; s += 45) { const p = northAt(s, 4); anchors.push(new Vector3(p.x, heightAt(p.x, p.z) + 3, p.z)); glow.sph(0.6, "#ffffff", [p.x, heightAt(p.x, p.z) + 3, p.z], [1, 1.4, 1], 4); }
  for (const m of k.buildAll("town", vcMat(scene, "vcWorld", 0.05))) m.metadata = { solid: true };
  for (const m of roofs.buildAll("townRoof", vcMat(scene, "vcWorld", 0.05))) m.isPickable = false;
  glow.build("townGlow", glowMat(scene, "#ffb35a")).isPickable = false;
}

// --- yapon kəndləri: taxta-suvaq evlər, qalın damlar, düyü tarlaları, fənərlər, quyu ---
function buildHamlets(scene: Scene, grid: Grid, anchors: Vector3[]) {
  const k = new Kit(scene), glow = new Kit(scene), field = new Kit(scene), r = rng(5);
  k.texMap = { [WOOD]: ["cedar", "#8a6448"], [PLAST]: ["whitewall", "#f2eadc"], [SLATE]: ["slate", "#7a7060"], [STONE]: ["jstone", "#c8c8c8"] };
  for (const v of HAMLETS) {
    const y0 = hillsAt(v.x, v.z), n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.3, d = 13 + r() * 12, x = v.x + Math.sin(a) * d, z = v.z + Math.cos(a) * d;
      const w = 6 + r() * 3, dd = 5 + r() * 2, rot: [number, number, number] = [0, a, 0];
      k.box(w + 0.6, 0.5, dd + 0.6, STONE, [x, y0 + 0.25, z], rot).box(w, 3, dd, WOOD, [x, y0 + 2, z], rot).box(w + 0.02, 1.2, dd + 0.02, PLAST, [x, y0 + 2.6, z], rot)
        .roof(w + 2.4, dd + 2.4, 2.6, SLATE, [x, y0 + 4.8, z], a, 0.45);
      glow.box(1.2, 0.8, 0.1, "#ffffff", [x - Math.sin(a) * (dd / 2 + 0.05), y0 + 2.1, z - Math.cos(a) * (dd / 2 + 0.05)], rot);
      grid.add({ x, z, r: Math.max(w, dd) / 2 + 0.4 });
    }
    k.cyl(1, 2.2, 2.4, STONE, [v.x, y0 + 0.5, v.z], undefined, 10); grid.add({ x: v.x, z: v.z, r: 1.4 }); // quyu
    glow.cyl(0.6, 0.5, 0.5, "#ffffff", [v.x + 3, y0 + 2.4, v.z], undefined, 8); k.cyl(2.4, 0.15, 0.15, WOOD, [v.x + 3, y0 + 1.2, v.z], undefined, 5);
    anchors.push(new Vector3(v.x + 3, y0 + 2.4, v.z));
    for (let j = 0; j < 4; j++) { // düyü tarlaları (su əks etdirir)
      const a = j * 1.6 + 0.4, x = v.x + Math.sin(a) * (v.r + 14), z = v.z + Math.cos(a) * (v.r + 14);
      field.box(16, 0.2, 12, "#2c4a3a", [x, heightAt(x, z) + 0.05, z], [0, a, 0]);
    }
  }
  for (const m of k.buildAll("hamlet", vcMat(scene, "vcWorld", 0.05))) m.metadata = { solid: true };
  glow.build("hamletGlow", glowMat(scene, "#ffb35a")).isPickable = false;
  const fm = new StandardMaterial("rice", scene);
  fm.diffuseColor = new Color3(0.12, 0.2, 0.15); fm.specularColor = new Color3(0.8, 0.85, 0.9); fm.specularPower = 120;
  field.build("rice", fm).isPickable = false;
}

// --- yapon saray kompleksi ---
const WOOD = "#4a2e1c", PLAST = "#d8cfb8", SLATE = "#2a2e35", STONE = "#77736a", RED = "#7e2418";

function hall(k: Kit, glow: Kit, x: number, z: number, w: number, d: number, h: number) {
  k.box(w + 1.5, 0.8, d + 1.5, STONE, [x, 0.4, z]).box(w, h, d, WOOD, [x, 0.8 + h / 2, z]).box(w + 0.05, h * 0.35, d + 0.05, PLAST, [x, 0.8 + h * 0.62, z]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.45, h + 0.2, 0.45, "#2a1a10", [x + (sx * w) / 2, 0.8 + h / 2, z + (sz * d) / 2]);
  for (let i = -1; i <= 1; i++) glow.box(w * 0.18, h * 0.3, 0.1, "#ffffff", [x + (i * w) / 3.3, 0.8 + h * 0.4, z + d / 2 + 0.06]);
  k.roof(w + 4, d + 4, 2.6, SLATE, [x, 0.8 + h + 1.2, z], 0, 0.35);
}

export const DOJO = { x: 0, z: -20 };

function buildPalace(scene: Scene, grid: Grid, anchors: Vector3[]) {
  const k = new Kit(scene), glow = new Kit(scene), deco = new Kit(scene);
  const tm: Record<string, [string, string]> = {
    [STONE]: ["jstone", "#c8c8c8"], [WOOD]: ["cedar", "#8a6448"], [PLAST]: ["whitewall", "#ffffff"], [SLATE]: ["slate", "#8a9098"],
    "#3a2414": ["cedar", "#6a4a34"], "#2a1a10": ["cedar", "#5a3a28"], "#6b4a2c": ["cedar", "#b08a68"], "#8d877b": ["cobble", "#d0d0d0"], "#5a4636": ["jstone", "#888"],
  };
  k.texMap = tm; deco.texMap = tm;
  const X = 40, Z1 = -34, Z2 = 36;
  const wall = (x1: number, z1: number, x2: number, z2: number) => {
    const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    k.box(0.9, 2.8, L, PLAST, [cx, 1.4, cz], [0, a, 0]).box(0.95, 0.4, L, "#5a4636", [cx, 0.2, cz], [0, a, 0]).box(1.8, 0.4, L + 0.6, SLATE, [cx, 3.0, cz], [0, a, 0]);
    segObs(grid, x1, z1, x2, z2, 0.8);
  };
  wall(-X, Z1, X, Z1); wall(-X, Z1, -X, Z2); wall(X, Z1, X, Z2); wall(-X, Z2, -5, Z2); wall(5, Z2, X, Z2);
  for (const sx of [-1, 1]) k.box(0.7, 4.2, 0.7, WOOD, [sx * 4.6, 2.1, Z2]);
  k.roof(13, 4.5, 1.6, SLATE, [0, 5, Z2], 0, 0.4);
  // dojo — içi boş əsas zal (ninjalar burada), qapı həyətə açılır
  const DZ = DOJO.z, DW = 30, DD = 20, DH = 7, zb = DZ - DD / 2, zf = DZ + DD / 2;
  k.box(DW + 2, 0.8, DD + 2, STONE, [0, 0.4, DZ]).box(DW, 0.12, DD, "#6b4a2c", [0, 0.86, DZ]);
  const dw = (x1: number, z1: number, x2: number, z2: number) => {
    const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1);
    k.box(0.5, DH, L, WOOD, [(x1 + x2) / 2, 0.8 + DH / 2, (z1 + z2) / 2], [0, a, 0]).box(0.55, DH * 0.3, L, PLAST, [(x1 + x2) / 2, 0.8 + DH * 0.7, (z1 + z2) / 2], [0, a, 0]);
    segObs(grid, x1, z1, x2, z2, 0.7);
  };
  dw(-DW / 2, zb, DW / 2, zb); dw(-DW / 2, zb, -DW / 2, zf); dw(DW / 2, zb, DW / 2, zf); dw(-DW / 2, zf, -3.5, zf); dw(3.5, zf, DW / 2, zf);
  k.box(7, 1.6, 0.5, WOOD, [0, DH, zf]);
  k.roof(DW + 5, DD + 5, 3, SLATE, [0, 0.8 + DH + 1.4, DZ], 0, 0.45).roof(DW - 6, DD - 5, 2.6, SLATE, [0, 0.8 + DH + 4.4, DZ], 0, 0.3);
  for (const sx of [-6, 6]) for (let zz = zb + 4; zz < zf - 2; zz += 5) {
    deco.cyl(DH, 0.55, 0.55, "#3a2414", [sx, 0.8 + DH / 2, zz], undefined, 8);
    glow.cyl(0.7, 0.5, 0.5, "#ffffff", [sx, DH - 1.2, zz + 1.2], undefined, 8);
    grid.add({ x: sx, z: zz, r: 0.5 });
  }
  deco.box(12, 0.6, 4, "#5a3a22", [0, 1.1, zb + 2.5]);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    deco.box(0.15, 2.2, 0.15, "#2a1a10", [sx * 13.5, 1.9, zb + 3 + i * 1.2]);
    deco.box(0.06, 2.6, 0.06, i % 2 ? "#8a8a8a" : "#5a3a22", [sx * 13.3, 2.1, zb + 3.6 + i * 1.2], [0.15, 0, 0]);
  }
  anchors.push(new Vector3(0, 5, DZ));
  hall(k, glow, -27, 0, 12, 16, 4.5); rectObs(grid, -27, 0, 12, 16);
  hall(k, glow, 27, 0, 12, 16, 4.5); rectObs(grid, 27, 0, 12, 16);
  hall(k, glow, 33, 28, 6, 6, 9); rectObs(grid, 33, 28, 6, 6);
  // gölməçə, körpü, daşlar, bonsai şamlar
  const pond = MeshBuilder.CreateDisc("pond", { radius: 7, tessellation: 24 }, scene);
  pond.rotation.x = Math.PI / 2; pond.scaling.y = 0.6; pond.position.set(-15, 0.06, 14);
  const water = new StandardMaterial("water", scene);
  water.diffuseColor = new Color3(0.04, 0.08, 0.12); water.specularColor = new Color3(0.9, 0.95, 1); water.specularPower = 90;
  pond.material = water; pond.isPickable = false;
  deco.box(2, 0.3, 9, RED, [-15, 0.5, 14]);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; deco.sph(1 + (i % 3) * 0.4, STONE, [-15 + Math.cos(a) * 7.3, 0.2, 14 + Math.sin(a) * 4.5], [1, 0.6, 1], 3); }
  for (const [x, z] of [[-24, 22], [-8, 24], [14, 18], [-22, -8]]) deco.cyl(1.2, 0.3, 0.4, "#3b2a1c", [x, 0.6, z], undefined, 5).sph(3, "#1d3a22", [x, 2, z], [1.3, 0.6, 1.3], 4);
  deco.box(3.2, 0.1, Z2 - zf, "#8d877b", [0, 0.07, (Z2 + zf) / 2]);
  // daş fənərlər (tōrō)
  for (const [x, z] of [[-4, 30], [4, 30], [-4, 20], [4, 20], [-4, 10], [4, 10], [-5, 46], [5, 46], [-5, 58], [5, 58]]) {
    deco.cyl(0.25, 0.9, 1.1, STONE, [x, 0.12, z], undefined, 6).cyl(1.1, 0.3, 0.4, STONE, [x, 0.8, z], undefined, 6)
      .box(0.9, 0.7, 0.9, STONE, [x, 1.6, z]).roof(1.6, 1.6, 0.5, STONE, [x, 2.2, z], 0, 0.2);
    glow.box(0.5, 0.45, 0.95, "#ffffff", [x, 1.6, z]);
    grid.add({ x, z, r: 0.6 });
    anchors.push(new Vector3(x, 2, z));
  }
  for (const sx of [-1, 1]) { deco.cyl(7, 0.7, 0.75, RED, [sx * 4, 3.5, 52], undefined, 8); grid.add({ x: sx * 4, z: 52, r: 0.6 }); }
  deco.box(11.5, 0.7, 0.9, "#1a1a1a", [0, 7.2, 52]).box(9.5, 0.5, 0.6, RED, [0, 6.1, 52]);

  for (const m of k.buildAll("palace", vcMat(scene, "vcWorld", 0.05))) m.metadata = { solid: true };
  for (const m of deco.buildAll("palaceDeco", vcMat(scene, "vcWorld", 0.05))) m.isPickable = false;
  glow.build("palaceGlow", glowMat(scene, "#ffb35a")).isPickable = false;
}
