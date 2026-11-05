// Osmanlı qəsri: dişli daş divar, dişli dəyirmi qüllələr, darvaza, çoxmərtəbəli saray-qala, yaşıl bayraqlar,
// divarın içində və çölündə kənd evləri, küçələr, məşəllər. PBR toxumalar; hər toxuma bir birləşmiş meş (az çəkiliş).
import { Color3, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { type FortLayout, type Grid } from "./logic";
import { glowMat, Kit, vcMat } from "./kit";
import { segObs } from "./world";

const STONE = "#b3a68c", STONE2 = "#9e917a", ROOF = "#8e4a2e", LEAD = "#5f6870";

export function buildFort(scene: Scene, f: FortLayout, grid: Grid, anchors: Vector3[], flagHex: string) {
  const { site: st, base: B, wallH: H, gate } = f;
  const P = (a: number, r: number, y = B): [number, number, number] => [st.x + Math.sin(a) * r, y, st.z + Math.cos(a) * r];
  const mat = vcMat(scene, "vcFort", 0.04);
  // rəng → PBR toxuma: qum daşı divarlar, suvaq, kirəmit, daş döşəmə, taxta
  const TM: Record<string, [string, string]> = {
    [STONE]: ["sandstone", "#e8dcc4"], [STONE2]: ["sandstone", "#cfc3aa"], [ROOF]: ["roof", "#ffffff"], "#a8977c": ["sandstone", "#d8ccb4"],
    "#e2d6bf": ["plaster", "#ffffff"], "#c2b293": ["sandstone", "#efe4cc"], "#cdbf9f": ["plaster", "#f0e8d8"], "#a89878": ["sandstone", "#c8b898"],
    "#7d7466": ["cobble", "#d0d0d0"], "#8d877b": ["cobble", "#e0e0e0"], "#3e2a1a": ["cedar", "#7a5a40"], "#4a3020": ["cedar", "#6a4a34"],
  };
  const sk = Object.assign(new Kit(scene), { texMap: TM }); // bərk (güllə keçmir)

  // divar seqmentləri + dişlər (merlon)
  for (const w of f.wall) {
    sk.box(3.2, H, w.len + 0.3, STONE, [w.x, B + H / 2, w.z], [0, w.a, 0]);
    const ox = -Math.cos(w.a) * 1.3, oz = Math.sin(w.a) * 1.3; // çöl tərəf
    for (let t = -w.len / 2 + 1; t < w.len / 2; t += 2.4)
      sk.box(0.6, 1.1, 1.2, STONE2, [w.x + Math.sin(w.a) * t + ox, B + H + 0.55, w.z + Math.cos(w.a) * t + oz], [0, w.a, 0]);
    segObs(grid, w.x - (Math.sin(w.a) * w.len) / 2, w.z - (Math.cos(w.a) * w.len) / 2, w.x + (Math.sin(w.a) * w.len) / 2, w.z + (Math.cos(w.a) * w.len) / 2, 1.8);
  }
  // dəyirmi qüllələr — üstündə dişli tac
  for (const t of f.towers) {
    sk.cyl(H + 4, 8, 8.6, STONE2, [t.x, B + (H + 4) / 2, t.z], undefined, 14).cyl(0.5, 9.6, 9.6, STONE, [t.x, B + H + 4.2, t.z], undefined, 14);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; sk.box(0.9, 1.1, 0.7, STONE, [t.x + Math.sin(a) * 4.5, B + H + 5, t.z + Math.cos(a) * 4.5], [0, a, 0]); }
    grid.add({ x: t.x, z: t.z, r: 4.4 });
  }

  // darvaza: tağ + açıq qapı tayları + daş körpü-yol
  const g = Object.assign(new Kit(scene), { texMap: TM }), gp = P(gate, st.R);
  g.box(13, 3.2, 3.6, STONE2, [gp[0], B + H - 1.6, gp[2]], [0, gate, 0]).box(4.5, 2, 3.8, STONE, [gp[0], B + H + 1, gp[2]], [0, gate, 0]);
  for (const s of [-1, 1]) {
    const q = P(gate + (s * 4.6) / st.R, st.R - 2.5);
    g.box(0.3, H - 3.4, 4.2, "#3e2a1a", [q[0], B + (H - 3.4) / 2, q[2]], [0, gate + s * 0.3, 0]);
  }
  // saray-qala: çoxmərtəbəli fasad, künc qüllələri, mərkəzdə qübbə
  const pk = Object.assign(new Kit(scene), { texMap: TM }), cx = st.x, cz = st.z;
  const lp = (lx: number, lz: number, y: number): [number, number, number] => [cx + Math.sin(gate) * lz + Math.cos(gate) * lx, y, cz + Math.cos(gate) * lz - Math.sin(gate) * lx];
  pk.box(34, 12, 24, "#c2b293", lp(0, 0, B + 6), [0, gate, 0]).box(26, 6, 18, "#cdbf9f", lp(0, 0, B + 15), [0, gate, 0])
    .box(35, 0.8, 25, STONE2, lp(0, 0, B + 12.2), [0, gate, 0]).box(10, 7, 3, "#a89878", lp(0, 12.5, B + 3.5), [0, gate, 0])
    .cyl(3, 9, 9, LEAD, lp(0, 0, B + 19.5), undefined, 14).sph(10, LEAD, lp(0, 0, B + 21), [1, 0.75, 1], 10, 0.5)
    .cyl(2.2, 0, 0.5, "#d4a640", lp(0, 0, B + 26.5), undefined, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pk.cyl(17, 5.5, 6, STONE2, lp(sx * 17, sz * 12, B + 8.5), undefined, 12);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const p = lp(sx * 17, sz * 12, B + 17.4); pk.box(0.7, 0.9, 0.6, STONE, [p[0] + Math.sin(a) * 3, p[1], p[2] + Math.cos(a) * 3], [0, a, 0]); }
  }
  // fasadda pəncərə sıraları (işıqlı)
  const win = new Kit(scene);
  for (let fl = 0; fl < 2; fl++) for (let i = -5; i <= 5; i++) if (i !== 0 || fl) win.box(1, 1.6, 0.2, "#ffffff", lp(i * 2.8, 12.05, B + 4 + fl * 5), [0, gate, 0]);
  for (let i = -3; i <= 3; i++) win.box(0.9, 1.4, 0.2, "#ffffff", lp(i * 3.2, 9.05, B + 15), [0, gate, 0]);
  grid.add({ x: cx, z: cz, r: 15 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = lp(sx * 17, sz * 12, 0); grid.add({ x: p[0], z: p[2], r: 3.2 }); }
  for (const sx of [-1, 1]) { const p = lp(sx * 9, 0, 0); grid.add({ x: p[0], z: p[2], r: 11 }); }

  // küçələr (radial + halqa), daş döşəmə
  const street = Object.assign(new Kit(scene), { texMap: TM });
  for (const a of f.streets) { const r1 = 26, r2 = st.R - 2, m = P(a, (r1 + r2) / 2, B + 0.1); street.box(6, 0.12, r2 - r1, "#7d7466", m, [0, a, 0]); }
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, m = P(a, f.ring, B + 0.1); street.box(f.ring * 0.21, 0.12, 6, "#7d7466", m, [0, a, 0]); }
  street.box(12, 0.12, 30, "#8d877b", P(gate, st.R + 16, B + 0.12), [0, gate, 0]); // darvaza önü
  for (const m of street.buildAll("fstreet", vcMat(scene, "vcStreet", 0))) { m.isPickable = false; m.material!.zOffset = -1; }

  // evlər: daş alt mərtəbə, çıxmalı ağ suvaqlı üst mərtəbə (taxta tirli), kirəmit dam, bəzilərində işıqlı pəncərə
  const hk = Object.assign(new Kit(scene), { texMap: TM }), roofs = Object.assign(new Kit(scene), { texMap: TM }), lw = new Kit(scene);
  let wi = 0;
  for (const h of [...f.houses, ...f.village]) {
    const y = groundY(h.x, h.z, B, st), two = (Math.round(h.x * 7 + h.z * 3) % 5 + 5) % 5 > 1, r: [number, number, number] = [0, h.rot, 0];
    hk.box(h.w, 3.2, h.d, "#a8977c", [h.x, y + 1.6, h.z], r);
    if (two) hk.box(h.w + 0.8, 2.6, h.d + 0.8, "#e2d6bf", [h.x, y + 4.5, h.z], r).box(h.w + 0.85, 0.15, h.d + 0.85, "#4a3020", [h.x, y + 3.25, h.z], r);
    roofs.roof(h.w + 1.6, h.d + 1.6, 1.9, ROOF, [h.x, y + (two ? 5.8 : 3.2) + 0.95, h.z], h.rot, 0.3);
    if (wi++ % 3 === 0) { // pəncərə — mərkəzə baxan tərəfdə
      const off = h.d / 2 + (two ? 0.45 : 0.05), fx = h.x - Math.sin(h.rot) * off, fz = h.z - Math.cos(h.rot) * off;
      lw.box(1.1, 0.9, 0.1, "#ffffff", [fx, y + (two ? 4.4 : 1.8), fz], r);
    }
    grid.add({ x: h.x, z: h.z, r: Math.max(h.w, h.d) / 2 + 0.3 });
  }
  for (const m of hk.buildAll("fhouse", mat)) m.metadata = { solid: true };
  for (const m of roofs.buildAll("froof", mat)) m.isPickable = false;
  lw.build("fhwin", glowMat(scene, "#ffb35a")).isPickable = false;

  // məşəllər: qüllələrdə, darvazada, saray qapısında — uzaqdan görünən işıq nöqtələri
  const torch = new Kit(scene);
  for (const t of f.towers) torch.sph(0.9, "#ffffff", [t.x, B + H + 5.6, t.z], [1, 1.5, 1], 4);
  for (const s of [-1, 1]) {
    const q = P(gate + (s * 7.5) / st.R, st.R + 2.2, B + 4.5); torch.sph(0.7, "#ffffff", q, [1, 1.5, 1], 4); anchors.push(new Vector3(q[0], q[1], q[2]));
    const d = lp(s * 4, 14.2, B + 4); torch.sph(0.6, "#ffffff", d, [1, 1.5, 1], 4);
  }
  anchors.push(new Vector3(...lp(0, 15, B + 4)));
  for (let i = 0; i < f.patrol.length; i += 4) { const p = f.patrol[i]; torch.cyl(2.6, 0.12, 0.15, "#2a1a10", [p.x + 3.5, B + 1.3, p.z], undefined, 5); anchors.push(new Vector3(p.x + 3.5, B + 2.8, p.z)); }
  torch.build("ftorch", glowMat(scene, "#ff9a3a")).isPickable = false;

  // bayraqlar (yaşıl) — qəsr təmizlənəndə rəngi dəyişir
  const flagMat = new StandardMaterial("flag_" + st.id, scene);
  flagMat.diffuseColor = Color3.FromHexString(flagHex); flagMat.emissiveColor = Color3.FromHexString(flagHex).scale(0.25);
  flagMat.backFaceCulling = false;
  const flags = new Kit(scene), poles = new Kit(scene);
  const fp = [...f.towers.filter((_, i) => i % 2 === 0).map((t) => [t.x, B + H + 4.2, t.z]), ...[-1, 1].map((s) => lp(s * 17, -12, B + 17.8)), lp(0, 0, B + 27.5)];
  for (const [x, y, z] of fp) { poles.cyl(5, 0.15, 0.15, "#3a3a3a", [x, y + 2.5, z], undefined, 5); flags.box(2.6, 1.6, 0.05, "#ffffff", [x + 1.3, y + 4.2, z]); }
  poles.build("fpoles", mat).isPickable = false;
  flags.build("fflags", flagMat).isPickable = false;

  for (const m of [...g.buildAll("fgate", mat), ...pk.buildAll("fpal", mat), ...sk.buildAll("fwall", mat)]) m.metadata = { solid: true };
  win.build("fwin", glowMat(scene, "#ffb35a")).isPickable = false;
  return { flagMat };
}

import { heightAt, type Site } from "./logic";
/** evin oturduğu yer: içəridə düz, çöl kənddə relyefə görə */
function groundY(x: number, z: number, B: number, st: Site) { return Math.hypot(x - st.x, z - st.z) < st.R ? B : heightAt(x, z) - 0.3; }
