// Animasiyalı personajlar (Quaternius CC0): skeletli geyimli modellər + Universal Animation Library klipləri.
// Kütlə (500+ döyüşçü) üçün: hər (növ, hal) cütü üçün bir «şablon» skeletli meş animasiya oynayır,
// döyüşçülər onun instance-larıdır (bir çəkiliş) — hal dəyişəndə instance başqa şablona keçir.
// Papaq/dəbilqə və silah baş/əl sümüyünə çəki ilə bağlanıb şablonun içinə birləşdirilir.
import { AnimationGroup, LoadAssetContainerAsync, Matrix, Mesh, MultiMaterial, PBRMaterial, Color3, Scene, TransformNode, Vector3, VertexBuffer, VertexData, type AssetContainer, type InstancedMesh, type Material } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { Kit, vcMat } from "./kit";

export type AnimState = "idle" | "walk" | "run" | "attack" | "shoot" | "dead" | "crouch" | "crouchWalk" | "prone" | "roll";
/** Prone_Loop — Blender-də yığılıb (blender/scripts/prone.py → Soldier_Anims.glb), qalanı UAL1 */
export const CLIP: Record<AnimState, string> = { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop", attack: "Sword_Attack", shoot: "Pistol_Shoot", dead: "Death01",
  crouch: "Crouch_Idle_Loop", crouchWalk: "Crouch_Fwd_Loop", prone: "Prone_Loop", roll: "Roll" };
const DIR = import.meta.env.BASE_URL + "assets/chars/";

type Prop = (k: Kit) => unknown; // baş/əl mərkəzinə nisbətən (+z irəli, +y yuxarı)
/** glb — Blender modeli (public/assets/models/props.glb içində meş adı); yoxdursa Kit funksiyası işləyir */
interface Look { outfit: string; tint: string; head?: Prop; hand?: Prop; glbHead?: string; glbHand?: string }

export const hat = {
  bork: (k: Kit) => k.cyl(0.5, 0.26, 0.24, "#f2eee4", [0, 0.28, -0.05], [-0.22, 0, 0], 10).box(0.22, 0.45, 0.03, "#f2eee4", [0, 0.1, -0.2], [0.25, 0, 0]).cyl(0.08, 0.06, 0.08, "#d4a640", [0, 0.12, 0.12], [-0.2, 0, 0], 6),
  turban: (k: Kit) => k.sph(0.38, "#efe9dc", [0, 0.12, 0], [1, 0.7, 1], 6),
  kabuto: (k: Kit) => k.sph(0.34, "#17171b", [0, 0.1, -0.02], [1, 0.85, 1], 8).cyl(0.14, 0.32, 0.5, "#17171b", [0, -0.02, -0.05], undefined, 10)
    .box(0.03, 0.3, 0.025, "#d4a640", [-0.08, 0.26, 0.13], [0.25, 0, 0.45]).box(0.03, 0.3, 0.025, "#d4a640", [0.08, 0.26, 0.13], [0.25, 0, -0.45])
    .sph(0.26, "#a3171b", [0, -0.04, 0.12], [1, 0.95, 0.6], 8).box(0.13, 0.025, 0.02, "#e8e0d0", [0, -0.1, 0.2]),
  hood: (k: Kit) => k.box(0.24, 0.07, 0.04, "#0c0c0e", [0, -0.05, 0.14]),
  // kabalak: 1919 türk əsgərinin parçaya bükülmüş xaki dəbilqəsi
  kabalak: (k: Kit) => k.sph(0.36, "#7a7048", [0, 0.1, -0.01], [1, 0.72, 1.05], 8).cyl(0.1, 0.37, 0.37, "#6a6040", [0, 0.02, -0.01], undefined, 10)
    .box(0.3, 0.035, 0.04, "#5a5034", [0, 0.17, 0.02], [0, 0, 0.5]).box(0.3, 0.035, 0.04, "#5a5034", [0, 0.17, 0.02], [0, 0, -0.5]),
  // dəmir dəbilqə (geniş kənarlı)
  helmet: (k: Kit) => k.cyl(0.03, 0.52, 0.52, "#4a5148", [0, 0.06, 0], undefined, 12).sph(0.34, "#4a5148", [0, 0.1, 0], [1, 0.62, 1], 8, 0.5),
  kasa: (k: Kit) => k.cyl(0.24, 0.05, 0.8, "#c8b070", [0, 0.2, 0], undefined, 12),
};
export const arm = {
  katana: (k: Kit) => k.box(0.025, 0.025, 0.9, "#c8ccd2", [0, 0, 0.5]).box(0.03, 0.03, 0.22, "#1a1a1a", [0, 0, -0.02]).cyl(0.02, 0.09, 0.09, "#d4a640", [0, 0, 0.1], [Math.PI / 2, 0, 0], 8),
  sword: (k: Kit) => k.box(0.02, 0.05, 0.75, "#c8ccd2", [0, 0, 0.42], [0.12, 0, 0]).box(0.12, 0.02, 0.03, "#d4a640", [0, 0, 0.04]),
  musket: (k: Kit) => k.box(0.05, 0.08, 1.4, "#4a3020", [0, 0, 0.35]).cyl(0.9, 0.03, 0.03, "#2a2a2a", [0, 0.03, 0.75], [Math.PI / 2, 0, 0], 6),
  bow: (k: Kit) => k.box(0.03, 1.2, 0.04, "#5a3a22", [0, 0, 0.05]),
  // süngülü tüfəng: qoz qundaq, uzun lülə, ucunda süngü
  mauser: (k: Kit) => k.box(0.05, 0.09, 0.62, "#5a3a22", [0, -0.01, 0.05]).box(0.045, 0.07, 0.5, "#6a4428", [0, 0.0, 0.6])
    .cyl(1.0, 0.025, 0.03, "#26282c", [0, 0.04, 0.72], [Math.PI / 2, 0, 0], 6).box(0.02, 0.02, 0.12, "#3a3c40", [0.04, 0.06, 0.25])
    .box(0.012, 0.03, 0.42, "#c8ccd2", [0, 0.02, 1.4]).box(0.03, 0.03, 0.05, "#3a3c40", [0, 0.03, 1.2]),
  shuriken: (k: Kit) => k.box(0.03, 0.03, 0.4, "#2a2a2a", [0, 0, 0.18]),
};
export const LOOKS: Record<string, Look> = {
  samurai: { outfit: "Male_Ranger", tint: "#7a2a22", head: hat.kabuto, hand: arm.katana },
  ninja: { outfit: "Male_Ranger", tint: "#2a2a30", head: hat.hood, hand: arm.shuriken },
  yeniceri: { outfit: "Male_Ranger", tint: "#9a2a24", head: hat.bork, hand: arm.musket },
  ottoman: { outfit: "Male_Ranger", tint: "#3d6a40", head: hat.turban, hand: arm.sword },
  okcu: { outfit: "Male_Ranger", tint: "#5a6a34", head: hat.bork, hand: arm.bow },
  turk: { outfit: "Turk_Soldier", tint: "#7a7250", head: hat.kabalak, hand: arm.mauser, glbHead: "kabalak", glbHand: "mauser" },
  isgalci: { outfit: "Enemy_Soldier", tint: "#4a5868", head: hat.helmet, hand: arm.mauser, glbHead: "helmet", glbHand: "mauser" },
  swat: { outfit: "Enemy_Soldier", tint: "!#2a2a2e", head: hat.helmet, hand: arm.mauser, glbHead: "helmet", glbHand: "mauser" }, // qara forma, qara maska
  mulki: { outfit: "Male_Peasant", tint: "#ffffff" },
  mulki2: { outfit: "Female_Peasant", tint: "#ffffff" },
  koylu: { outfit: "Male_Peasant", tint: "#c8d0e0", head: hat.kasa },
};

/** Blender-də yığılmış əsgərlər (blender/soldiers.blend): eyni UAL skeleti, forma + təchizat; yüklənməsə Male_Ranger işləyir */
const SOLDIER = { Turk_Soldier: 1, Enemy_Soldier: 1 };
/** Blender əsgərinin başı Ranger-dən hündürdür — papaq bu qədər yuxarı */
export const HEAD_UP = 0.155;
const OUTFITS = ["Male_Ranger", "Male_Peasant", "Female_Peasant", ...Object.keys(SOLDIER)];

export class CharLib {
  private templates = new Map<string, Mesh[]>();
  /** ölüm anı üçün öz skeleti olan şablonlar (hər növə bir neçə): yıxılma əvvəldən oynayır */
  private dyingPool = new Map<string, { m: Mesh; ag: AnimationGroup; until: number; inst: InstancedMesh | null }[]>();
  private constructor(private scene: Scene, private anims: AssetContainer, private outfits: Record<string, AssetContainer>, private props: AssetContainer | null) {}

  static async load(scene: Scene): Promise<CharLib> {
    const [extra, props, anims, ...outs] = await Promise.all([LoadAssetContainerAsync(DIR + "Soldier_Anims.glb", scene).catch(() => null),
      LoadAssetContainerAsync(import.meta.env.BASE_URL + "assets/models/props.glb", scene).catch(() => null), LoadAssetContainerAsync(DIR + "UAL1.glb", scene),
      ...OUTFITS.map((o) => LoadAssetContainerAsync(DIR + o + ".gltf", scene).catch((e) => { if (o in SOLDIER) return null; throw e; }))]);
    const map: Record<string, AssetContainer> = {};
    OUTFITS.forEach((o, i) => { const c = outs[i] ?? outs[0]; if (c) map[o] = c; }); // Blender əsgəri yüklənməsə — köhnə Ranger
    if (extra) anims.animationGroups.push(...extra.animationGroups); // əlavə kliplər (uzanma) eyni skelet adları ilə
    return new CharLib(scene, anims, map, props);
  }
  private broken = false;
  has(type: string) { return !this.broken && type in LOOKS; }
  /** görünən instance-ı olmayan şablonların animasiyasını dayandır (prosessor qənaəti) — 0.5 s-də bir çağır */
  tick() {
    for (const [, ts] of this.templates) for (const m of ts) {
      const ag = m.metadata?.ag as AnimationGroup | undefined, used = m.instances.some((i) => i.isVisible);
      m.setEnabled(used);
      if (ag && !ag.isPlaying && used && !ag.name.includes("dead")) ag.play(true); else if (ag && ag.isPlaying && !used) ag.pause();
    }
  }
  /** bütün şablonları əvvəlcədən hazırla (oyun zamanı ilişmə olmasın) */
  warm(types: string[], states: AnimState[] = ["idle", "walk", "run", "attack", "shoot", "dead"]) { for (const t of types) for (const s of states) this.instance(t, s).dispose(); }

  /** ölüm hovuzunu əvvəlcədən hazırla (oyun ortasında ilişmə olmasın) */
  warmDying(types: string[], n = 3) {
    for (const t of types) {
      if (!(t in LOOKS)) continue;
      const pool = [];
      for (let i = 0; i < n; i++) { const m = this.template(LOOKS[t], "dead", 0); const ag = m.metadata.ag as AnimationGroup; ag.stop(); m.setEnabled(false); pool.push({ m, ag, until: 0, inst: null }); }
      this.dyingPool.set(t, pool);
    }
  }
  /** yıxılma: boş şablondan instance, Death01 əvvəldən (sürəti azca fərqli); dur — saniyə. Boş yoxdursa null */
  dying(type: string, now: number): { inst: InstancedMesh; dur: number } | null {
    const e = this.dyingPool.get(type)?.find((p) => p.until <= now && (!p.inst || p.inst.isDisposed()));
    if (!e) return null;
    const speed = 0.9 + Math.random() * 0.3, fps = e.ag.targetedAnimations[0]?.animation.framePerSecond ?? 30;
    const dur = (e.ag.to - e.ag.from) / fps / speed;
    e.m.setEnabled(true); e.ag.start(false, speed, e.ag.from, e.ag.to);
    e.inst = e.m.createInstance(type + "_dying"); e.inst.scaling.set(-1, 1, 1); e.inst.alwaysSelectAsActiveMesh = true;
    e.until = now + dur + 0.2;
    return { inst: e.inst, dur };
  }
  /** hovuzda iş qurtardısa şablonu söndür */
  /** bütün skeletli şablonlar (instance-lar onlarla birlikdə çəkilir) — kölgə siyahısı üçün */
  allTemplates(): Mesh[] { return [...[...this.templates.values()].flat(), ...[...this.dyingPool.values()].flat().map((p) => p.m)]; }
  tickDying(now: number) { for (const [, pool] of this.dyingPool) for (const p of pool) if (p.until <= now && (!p.inst || p.inst.isDisposed()) && p.m.isEnabled()) { p.m.setEnabled(false); p.ag.stop(); } }

  /** döyüşçü üçün instance: (növ, hal) şablonundan; 2 faza — addımlar sinxron görünməsin */
  instance(type: string, state: AnimState): InstancedMesh {
    const key = type + ":" + state;
    let t = this.templates.get(key);
    if (!t) {
      try { t = [this.template(LOOKS[type], state, Math.random())]; }
      catch (e) { this.broken = true; console.warn(e); throw e; }
      this.templates.set(key, t);
    }
    const src = t[Math.floor(Math.random() * t.length)];
    src.setEnabled(true);
    const inst = src.createInstance(type);
    inst.scaling.set(-1, 1, 1); // glTF sağ əlli → sol əlli güzgü (şablonun __root__ çevrilməsi kimi)
    inst.alwaysSelectAsActiveMesh = true; // sərhəd qutusu güzgülü yerdədir — kəsilməsin (yalnız yaxındakılar görünür)
    return inst;
  }

  /** oyunçu üçün tam skeletli personaj: bütün kliplər + baş/əl düyünləri (aksesuar bağlamaq üçün) */
  player(look: Look) {
    const inst = this.outfits[look.outfit].instantiateModelsToScene((n) => "P_" + n, false, { doNotInstantiate: true });
    const root = inst.rootNodes[0] as TransformNode, nodes = new Map(root.getDescendants(false).map((n) => [n.name.slice(2), n as TransformNode]));
    this.tint(root.getChildMeshes() as Mesh[], look.tint, "P");
    const clips: Partial<Record<string, AnimationGroup>> = {};
    for (const g of this.anims.animationGroups) {
      const c = g.clone("P_" + g.name, (t) => nodes.get(t.name) ?? null);
      c.stop(); clips[g.name] = c;
    }
    return { root, head: nodes.get("Head")!, hand: nodes.get("hand_r")!, clips, meshes: root.getChildMeshes() as Mesh[] };
  }

  private tint(meshes: Mesh[], hex: string, tag: string) {
    const force = hex[0] === "!", c = Color3.FromHexString(force ? hex.slice(1) : hex), done = new Map<Material, Material>();
    const fix = (m: Material | null): Material | null => {
      if (!m) return m;
      if (m instanceof MultiMaterial) { m.subMaterials = m.subMaterials.map((s) => fix(s)); return m; }
      if (!done.has(m)) { const n = m.clone(m.name + tag + hex)!; if (n instanceof PBRMaterial && (force ? !/eye/i.test(m.name) : !/skin|male|female|eye|hair|keep/i.test(m.name))) n.albedoColor = c; n.backFaceCulling = false; done.set(m, n); }
      return done.get(m)!;
    };
    for (const m of meshes) m.material = fix(m.material);
  }

  /** Blender modeli: props.glb-dən meşin surəti (glTF kök güzgüsü geri alınır — +x sağ, +y yuxarı, +z irəli) */
  glbProp(name: string | undefined, mat: Material): Mesh | null {
    const src = name ? (this.props?.meshes.find((m) => m.name === name) as Mesh | undefined) : undefined;
    if (!src || !src.getTotalVertices()) return null;
    const vd = VertexData.ExtractFromMesh(src, true, true);
    vd.transform(Matrix.Scaling(-1, 1, 1).multiply(src.computeWorldMatrix(true)));
    if (!vd.uvs) vd.uvs = new Float32Array((vd.positions!.length / 3) * 2); // birləşmə eyni atributları istəyir
    const m = new Mesh("prop", this.scene); vd.applyToMesh(m, true); m.material = mat;
    return m;
  }

  private template(look: Look, state: AnimState, phase: number): Mesh {
    const inst = this.outfits[look.outfit].instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    const root = inst.rootNodes[0] as TransformNode, skel = inst.skeletons[0];
    const nodes = new Map(root.getDescendants(false).map((n) => [n.name, n as TransformNode]));
    const parts = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0 && m.skeleton) as Mesh[];
    for (const m of root.getChildMeshes(false)) if (!parts.includes(m as Mesh)) m.setEnabled(false); // skeletsiz kiçik hissələr
    this.tint(parts, look.tint, state + phase);
    const inv = Matrix.Invert(root.computeWorldMatrix(true));
    const bindPos = (bone: string) => Vector3.TransformCoordinates(nodes.get(bone)!.getAbsolutePosition(), inv);
    // aksesuarlar: meş fəzasında baş/əl yerinə qoyulur və 100% həmin sümüyə bağlanır
    const props: Mesh[] = [];
    const add = (p: Prop | undefined, bone: string, off: Vector3, glb?: string) => {
      if (!p) return;
      const pm = vcMat(this.scene, "vcProp", 0.25); pm.backFaceCulling = false;
      const m = this.glbProp(glb, pm) ?? (() => { const k = new Kit(this.scene); p(k); return k.build("prop", pm); })(), at = bindPos(bone).add(off), bi = skel.getBoneIndexByName(bone);
      m.position.copyFrom(at); m.bakeCurrentTransformIntoVertices();
      const n = m.getTotalVertices();
      m.setVerticesData(VertexBuffer.MatricesIndicesKind, new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : bi)));
      m.setVerticesData(VertexBuffer.MatricesWeightsKind, new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)));
      m.skeleton = skel; props.push(m);
    };
    add(look.head, "Head", new Vector3(0, look.outfit in SOLDIER ? HEAD_UP : 0.1, 0), look.glbHead);
    add(look.hand, "hand_r", new Vector3(0, 0, 0.05), look.glbHand);
    // birləşdirmə üçün eyni atribut dəsti: glTF hissələrinə ağ vertex rəngi, artıq atributlar silinir
    for (const m of parts) if (!m.isVerticesDataPresent(VertexBuffer.ColorKind)) m.setVerticesData(VertexBuffer.ColorKind, new Float32Array(m.getTotalVertices() * 4).fill(1));
    const all = [...parts, ...props], common = all.map((m) => m.getVerticesDataKinds()).reduce((a, b) => a.filter((k) => b.includes(k)));
    for (const m of all) for (const k of m.getVerticesDataKinds()) if (!common.includes(k)) m.removeVerticesData(k);
    const parent = parts[0].parent;
    for (const m of parts) { m.parent = null; m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); }
    for (const m of all) { m.skeleton = skel; m.sideOrientation = parts[0].sideOrientation; } // birləşmə eyni yönləndirmə tələb edir
    const merged = Mesh.MergeMeshes(all, true, true, undefined, false, true);
    if (!merged) throw new Error("personaj birləşmədi: " + look.outfit);
    merged.skeleton = skel; merged.parent = parent; merged.isVisible = false; merged.isPickable = true;
    merged.alwaysSelectAsActiveMesh = true; // instance-lar hər yerdə — şablon kəsilməsin
    const src = this.anims.animationGroups.find((g) => g.name === CLIP[state]) ?? this.anims.animationGroups.find((g) => g.name === "Crouch_Idle_Loop")!;
    const ag = src.clone(src.name + state + phase, (t) => nodes.get(t.name) ?? null);
    ag.start(state !== "dead", state === "attack" ? 1.2 : 1);
    if (state !== "dead") ag.goToFrame(ag.from + (ag.to - ag.from) * phase);
    merged.metadata = { ag };
    return merged;
  }
}
