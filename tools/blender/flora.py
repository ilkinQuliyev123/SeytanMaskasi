"""Blender (bpy) ilə prosedur low-poly bitki örtüyü: ağaclar, kollar, qayalar.

İşlətmək:
  blender --background --factory-startup --python tools/blender/flora.py -- <çıxış.json> [önizləmə.png]

Hər model düz (flat) üçbucaqlar + vertex rəngi kimi JSON-a yazılır (Y yuxarı, metr).
Oyunda `src/game/flora.ts` bunu VertexData-ya çevirir (sinxron, yükləmə gözləmədən).
Üçbucaq büdcəsi aşağıdır: minlərlə thin instance HD 4400-də hamar getməlidir.
"""
import bpy, bmesh, json, math, random, sys
from mathutils import Vector, Matrix, noise, Color

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGV[0] if ARGV else "flora.json"
PREVIEW = ARGV[1] if len(ARGV) > 1 else None


def hexrgb(h):
    h = h.lstrip("#")
    return Vector((int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255))


def jitter(c, rnd, amt=0.06):
    hsv = Color(c[:3]).hsv
    col = Color()
    col.hsv = ((hsv[0] + rnd.uniform(-amt, amt) * 0.25) % 1, min(1, max(0, hsv[1] * rnd.uniform(1 - amt, 1 + amt))),
               min(1, max(0, hsv[2] * rnd.uniform(1 - amt * 2, 1 + amt * 2))))
    return Vector(col[:])


class Model:
    """Üçbucaq toplayıcı: hər üzün öz rəngi (flat low-poly görünüş)."""

    def __init__(self, name):
        self.name, self.tris = name, []  # [(v0,v1,v2), rgb]

    def add_bm(self, bm, color_fn):
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        for f in bm.faces:
            vs = [v.co.copy() for v in f.verts]
            c = color_fn(f, sum(vs, Vector()) / 3)
            self.tris.append((vs, c, f.normal.copy()))
        bm.free()

    def export(self):
        pos, col, nor = [], [], []
        for vs, c, n in self.tris:
            for v in vs:
                # Blender (Z yuxarı, sağ əl) -> oyun (Y yuxarı): (x, z, y)
                pos += [round(v.x, 3), round(v.z, 3), round(v.y, 3)]
            nor += [round(n.x, 2), round(n.z, 2), round(n.y, 2)]  # üz normalı (hər üçbucağa bir)
            col += [int(max(0, min(1, x)) * 255 + 0.5) for x in c[:3]]
        return {"p": pos, "n": nor, "c": col, "tris": len(self.tris)}


def displace(bm, rnd, amt, scale=0.9, seed=0):
    off = Vector((rnd.random() * 50, rnd.random() * 50, seed))
    for v in bm.verts:
        n = noise.noise_vector(v.co * scale + off)
        v.co += n * amt


def blob(center, radius, squash=(1, 1, 1), subdiv=1, rnd=None, amt=0.25):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * squash[0], v.co.y * squash[1], v.co.z * squash[2]))
    if rnd:
        displace(bm, rnd, radius * amt, 1.6 / radius)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
    return bm


def trunk(h, r0, r1, sides=5, lean=(0, 0), bend=0.0, segs=2):
    bm = bmesh.new()
    rings = []
    for i in range(segs + 1):
        t = i / segs
        r = r0 + (r1 - r0) * t
        cx = lean[0] * t + bend * math.sin(t * math.pi) * 0.5
        cy = lean[1] * t
        ring = []
        for k in range(sides):
            a = k / sides * math.tau + i * 0.3
            ring.append(bm.verts.new((cx + math.cos(a) * r, cy + math.sin(a) * r, h * t)))
        rings.append(ring)
    for i in range(segs):
        for k in range(sides):
            a, b = rings[i][k], rings[i][(k + 1) % sides]
            c, d = rings[i + 1][(k + 1) % sides], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    bm.faces.new(list(reversed(rings[-1])))
    return bm


def cone(base_z, h, r, sides, rnd, droop=0.25, rough=0.18):
    """şam qatı: kənarları sallanan, nizamsız konus"""
    bm = bmesh.new()
    tip = bm.verts.new((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), base_z + h))
    rim, inner = [], []
    for k in range(sides):
        a = k / sides * math.tau + rnd.uniform(-0.15, 0.15)
        rr = r * rnd.uniform(1 - rough, 1 + rough)
        rim.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, base_z - droop * rnd.uniform(0.6, 1.3))))
        inner.append(bm.verts.new((math.cos(a + math.pi / sides) * r * 0.45, math.sin(a + math.pi / sides) * r * 0.45, base_z + h * 0.08)))
    for k in range(sides):
        n = (k + 1) % sides
        bm.faces.new((rim[k], rim[n], tip))
        bm.faces.new((rim[n], rim[k], inner[k]))  # alt üz (aşağıdan baxanda boş görünməsin)
    return bm


def shade(base, top, rnd, z0, z1, ao_center=None, ao_amt=0.35, var=0.07):
    """hündürlüyə görə qradiyent + mərkəzə yaxın kölgə (AO) + hər üzə kiçik fərq"""
    b, t = hexrgb(base), hexrgb(top)

    def fn(face, c):
        k = min(1, max(0, (c.z - z0) / max(0.01, z1 - z0)))
        col = b.lerp(t, k)
        # yuxarı baxan üzlər bir az açıq (səma işığı)
        col = col * (0.88 + 0.22 * max(0, face.normal.z))
        if ao_center is not None:
            d = (Vector((c.x, c.y)) - Vector(ao_center[:2])).length
            col = col * (1 - ao_amt * max(0, 1 - d / 2.5))
        return jitter(col, rnd, var)

    return fn


def solid(hex_, rnd, var=0.06, dark_bottom=0.0, h=1.0):
    base = hexrgb(hex_)

    def fn(face, c):
        col = base * (1 - dark_bottom * max(0, 1 - c.z / h))
        return jitter(col, rnd, var)

    return fn


BARK = "#4a3424"


# ---------------- modellər ----------------

def pine(seed):
    rnd = random.Random(seed)
    m = Model("pine")
    H = 10.5
    m.add_bm(trunk(H * 0.55, 0.32, 0.12, 5, (rnd.uniform(-.2, .2), rnd.uniform(-.2, .2))), solid(BARK, rnd, dark_bottom=0.4, h=4))
    tiers = 5
    for i in range(tiers):
        t = i / (tiers - 1)
        z = 2.2 + t * (H - 3.6)
        r = 2.9 * (1 - t * 0.72) + rnd.uniform(-0.15, 0.15)
        h = 2.6 - t * 0.6
        bm = cone(z, h, r, 7, rnd, droop=0.55 - t * 0.25)
        m.add_bm(bm, shade("#214a2b", "#548a44", rnd, 1.5, H, (0, 0), 0.22))
    return m


def broad(seed, base, top, name, H=8.5, crown=3.0, clumps=4, trunk_c=BARK):
    rnd = random.Random(seed)
    m = Model(name)
    lean = (rnd.uniform(-.3, .3), rnd.uniform(-.3, .3))
    m.add_bm(trunk(H * 0.5, 0.36, 0.2, 5, lean, segs=2), solid(trunk_c, rnd, dark_bottom=0.35, h=3))
    # 2 budaq
    for k in range(2):
        a = rnd.uniform(0, math.tau)
        bm = trunk(crown * 0.9, 0.16, 0.07, 4)
        rot = Matrix.Rotation(math.radians(48), 4, Vector((math.cos(a), math.sin(a), 0)))
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((lean[0] * 0.8, lean[1] * 0.8, H * 0.42)))
        m.add_bm(bm, solid(trunk_c, rnd))
    cz = H * 0.62
    sh = shade(base, top, rnd, cz - crown, cz + crown, (lean[0], lean[1]), 0.25)
    m.add_bm(blob((lean[0], lean[1], cz), crown, (1, 1, 0.82), 2, rnd, 0.22), sh)
    for k in range(clumps):
        a = k / clumps * math.tau + rnd.uniform(-.4, .4)
        d = crown * rnd.uniform(0.6, 0.85)
        c = (lean[0] + math.cos(a) * d, lean[1] + math.sin(a) * d, cz + rnd.uniform(-0.9, 1.1))
        m.add_bm(blob(c, crown * rnd.uniform(0.48, 0.62), (1, 1, 0.85), 2 if k == 0 else 1, rnd, 0.18), sh)
    return m


def cypress(seed):
    rnd = random.Random(seed)
    m = Model("cypress")
    m.add_bm(trunk(2.2, 0.26, 0.2, 5), solid(BARK, rnd, dark_bottom=0.4, h=2))
    sh = shade("#1c3d22", "#3f6d3c", rnd, 1, 12, (0, 0), 0.2)
    m.add_bm(blob((0, 0, 6.3), 1.6, (1, 1, 3.4), 2, rnd, 0.12), sh)
    m.add_bm(blob((0.15, 0.1, 10.4), 0.9, (1, 1, 2.0), 1, rnd, 0.1), sh)
    return m


def bush(seed, base="#2f4a1f", top="#57722c", name="bush"):
    rnd = random.Random(seed)
    m = Model(name)
    sh = shade(base, top, rnd, 0, 1.8, (0, 0), 0.3)
    m.add_bm(blob((0, 0, 0.55), 1.05, (1.25, 1.1, 0.8), 2, rnd, 0.22), sh)
    for k in range(2):
        a = rnd.uniform(0, math.tau)
        m.add_bm(blob((math.cos(a) * 0.8, math.sin(a) * 0.8, 0.45), 0.7, (1, 1, 0.85), 1, rnd, 0.15), sh)
    return m


def rock(seed, name="rock", hex_="#77736b"):
    rnd = random.Random(seed)
    m = Model(name)
    bm = blob((0, 0, 0.35), 1.0, (1.3, 1.0, 0.7), 2, rnd, 0.32)
    base = hexrgb(hex_)
    moss = hexrgb("#4f5e2c")

    def fn(face, c):
        col = base * (0.8 + 0.3 * max(0, face.normal.z))
        if face.normal.z > 0.65 and rnd.random() < 0.55:
            col = col.lerp(moss, 0.6)
        return jitter(col, rnd, 0.05)

    m.add_bm(bm, fn)
    return m


MODELS = [
    pine(3), pine(17),
    broad(5, "#285a2c", "#4f8a3c", "broad"),
    broad(9, "#9c3a16", "#ec9a38", "maple", H=7.6, crown=2.7),
    broad(13, "#3a5a22", "#6e8e3a", "oak", H=8.2, crown=3.4, clumps=5),
    cypress(21),
    bush(31), bush(37, "#3a4a1f", "#6f7a34", "bushDry"),
    rock(41), rock(43, "rock2", "#8a7f6c"),
]
# eyni növün variantları: "pine", "pine_2" ...
seen = {}
for mdl in MODELS:
    seen[mdl.name] = seen.get(mdl.name, 0) + 1
    if seen[mdl.name] > 1:
        mdl.name = f"{mdl.name}_{seen[mdl.name]}"

data = {m.name: m.export() for m in MODELS}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))
print("FLORA_OK", {k: v["tris"] for k, v in data.items()})


# ---------------- önizləmə (yoxlama üçün) ----------------
if PREVIEW:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    x = 0.0
    for mdl in MODELS:
        me = bpy.data.meshes.new(mdl.name)
        verts, faces, cols = [], [], []
        for vs, c, _n in mdl.tris:
            i = len(verts)
            verts += [tuple(v) for v in vs]
            faces.append((i, i + 1, i + 2))
            cols += [c] * 3
        me.from_pydata(verts, [], faces)
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for li, loop in enumerate(me.loops):
            attr.data[li].color = (*cols[loop.vertex_index][:3], 1)
        ob = bpy.data.objects.new(mdl.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location.x = x
        x += 8.5
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    sh = scn.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_shadows = True
    sh.show_cavity = False
    scn.display.shading.background_type = "VIEWPORT"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scn.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = x + 4
    cam.location = (x / 2 - 4.25, -60, 6.2)
    cam.rotation_euler = (math.radians(86), 0, 0)
    scn.camera = cam
    scn.render.resolution_x, scn.render.resolution_y = 1400, 300
    scn.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print("PREVIEW_OK", PREVIEW)
