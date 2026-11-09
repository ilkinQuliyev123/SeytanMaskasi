"""Blender (bpy): Osmanlı məhəlləsi üçün modul sıra evlər.

  blender --background --factory-startup --python tools/blender/ottoman.py -- <çıxış.json> [önizləmə.png]

Hissə = 1 hüceyrə: eni 4.6 m (X), uzunluğu 5 m (Blender Y → oyun Z), ucları açıq — ardıcıl düzülür.
  otto1 — birmərtəbəli: qum daşı, kafəsli kiçik pəncərələr, kirəmit dam (tin uzununa)
  otto2 — ikimərtəbəli: daş alt + çıxıntılı suvaq üst mərtəbə (taxta karkas, dirsəklər), kafəsli pəncərələr
  otto1_end / otto2_end — evin ucuna alınlıq (üçbucaq divar + damın ucu), +Y tərəfə baxır
"""
import sys, os, math
import bmesh
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Model, hexrgb, jitter, write_json, preview

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGV[0] if ARGV else "ottoman.json"
PREVIEW = ARGV[1] if len(ARGV) > 1 else None

W, L = 4.6, 5.0
X, Y = W / 2, L / 2
SAND, SAND_D, PLASTER, TIMBER, TILE, SHUT, GLASS = "#b9a283", "#8f7a5e", "#e9dfc9", "#4a3020", "#a4513a", "#5b3b26", "#2a2420"
LOW = 3.4          # alt mərtəbə
UP = 2.6           # üst mərtəbə
OVER = 0.45        # üst mərtəbənin çıxıntısı (hər tərəfə)


def window(m, x_side, y, z, w=0.9, h=1.1, lattice=True, wall=X):
    """divarda pəncərə: tünd oyuq + taxta çərçivə + kafəs (x_side = ±1 divar tərəfi, wall — divarın yarı eni)"""
    s = x_side
    xw = s * (wall + 0.02)
    m.box((0.06, w, h), (xw, y, z), GLASS, var=0.02)
    for dy in (-w / 2, w / 2):
        m.box((0.12, 0.1, h + 0.1), (xw + s * 0.03, y + dy, z), SHUT)
    for dz in (-h / 2, h / 2):
        m.box((0.12, w + 0.1, 0.1), (xw + s * 0.03, y, z + dz), SHUT)
    if lattice:
        for k in (-1, 0, 1):
            m.box((0.08, 0.04, h), (xw + s * 0.04, y + k * w / 4, z), SHUT)
        for k in (-1, 1):
            m.box((0.08, w, 0.04), (xw + s * 0.04, y, z + k * h / 4), SHUT)


def gable_roof(m, half_w, eave_z, rise, length, color=TILE):
    """tin uzununa (Y) gedən iki yamaclı dam, ucları açıq; qalınlıq + kirəmit cizgiləri"""
    y0, y1 = -length / 2, length / 2
    top = eave_z + rise
    for s in (-1, 1):
        f = [(s * half_w, y0, eave_z), (s * half_w, y1, eave_z), (0, y1, top), (0, y0, top)]
        m.poly([f if s > 0 else list(reversed(f))], lambda fc, c: jitter(hexrgb(color) * (0.85 + 0.25 * max(0, fc.normal.z)), m.rnd, 0.05))
        # saçaq qalınlığı (alt üz)
        lo = [(s * half_w, y0, eave_z - 0.18), (s * half_w, y1, eave_z - 0.18), (s * half_w * 0.7, y1, eave_z + rise * 0.3 - 0.18), (s * half_w * 0.7, y0, eave_z + rise * 0.3 - 0.18)]
        m.poly([list(reversed(lo)) if s > 0 else lo], TIMBER)
        m.poly([[(s * half_w, y0, eave_z - 0.18), (s * half_w, y1, eave_z - 0.18), (s * half_w, y1, eave_z), (s * half_w, y0, eave_z)][:: 1 if s > 0 else -1]], TIMBER)
        # kirəmit cizgiləri (yamac boyu 3 tünd zolaq)
        for t in (0.25, 0.5, 0.75):
            z = eave_z + rise * t
            xx = s * half_w * (1 - t)
            m.box((0.08, length, 0.06), (xx, 0, z + 0.03), "#7e3a28", var=0.03)
    m.box((0.3, length, 0.22), (0, 0, top + 0.05), "#7e3a28")  # tin kirəmiti


def seg1(name="otto1", seed=1):
    m = Model(name, seed)
    m.box((W, L, LOW + 0.8), (0, 0, (LOW - 0.8) / 2), SAND, var=0.06)      # 0.8 m torpağa batır
    m.box((W + 0.12, L, 0.25), (0, 0, LOW - 0.12), SAND_D)                 # karniz
    for s in (-1, 1):
        window(m, s, -1.1, 2.0, 0.8, 1.0)
        window(m, s, 1.2, 2.0, 0.8, 1.0)
    gable_roof(m, X + 0.55, LOW, 1.5, L)
    return m


def seg2(name="otto2", seed=2):
    m = Model(name, seed)
    m.box((W, L, LOW + 0.8), (0, 0, (LOW - 0.8) / 2), SAND, var=0.06)
    for s in (-1, 1):
        window(m, s, 0.0, 1.9, 0.7, 0.9)
    # dirsəklər (çıxıntını saxlayan maili tirlər)
    for s in (-1, 1):
        for y in (-Y + 0.4, 0.0, Y - 0.4):
            m.box((OVER + 0.1, 0.16, 0.16), (s * (X + OVER / 2 - 0.05), y, LOW - 0.08), TIMBER)
            m.box((0.14, 0.14, 0.7), (s * (X + 0.12), y, LOW - 0.45), TIMBER)
    # üst mərtəbə: suvaq + taxta karkas
    UW = W + 2 * OVER
    m.box((UW, L, UP), (0, 0, LOW + UP / 2), PLASTER, var=0.03)
    for s in (-1, 1):
        xw = s * (UW / 2 + 0.03)
        for y in (-Y + 0.08, -Y / 2 - 0.3, Y / 2 + 0.3, Y - 0.08):
            m.box((0.1, 0.16, UP), (xw, y, LOW + UP / 2), TIMBER)
        for z in (LOW + 0.08, LOW + UP - 0.08):
            m.box((0.1, L, 0.16), (xw, 0, z), TIMBER)
        # pəncərələr üst mərtəbədə (daha böyük, kafəsli)
        for y in (-0.9, 0.9):
            window(m, s, y, LOW + 1.25, 0.9, 1.25, wall=UW / 2 + 0.05)
    gable_roof(m, UW / 2 + 0.5, LOW + UP, 1.7, L)
    return m


def end_cap(name, half_w, eave_z, rise, wall_half, wall_top, seed=3):
    """evin +Y ucu: üçbucaq suvaq alınlıq + taxta çərçivə"""
    m = Model(name, seed)
    y = Y - 0.02
    top = eave_z + rise
    hw = wall_half * (1 - 0.04)
    m.poly([[(-hw, y, wall_top), (hw, y, wall_top), (0, y, wall_top + rise * hw / half_w)]], PLASTER)
    m.box((2 * hw, 0.12, 0.14), (0, y + 0.04, wall_top + 0.05), TIMBER)
    m.box((0.14, 0.12, rise * hw / half_w), (0, y + 0.04, wall_top + rise * hw / half_w / 2), TIMBER)
    # damın ucunda kiçik saçaq (alınlığı örtən taxta)
    for s in (-1, 1):  # maili taxta lövhə (alınlıq kənarı)
        ang = math.atan2(rise, half_w)
        cx, cz = s * half_w / 2, eave_z + rise / 2
        b = bmesh.new()
        bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=Vector(((half_w ** 2 + rise ** 2) ** 0.5, 0.2, 0.2)), verts=b.verts)
        bmesh.ops.rotate(b, verts=b.verts, matrix=Matrix.Rotation(s * ang, 3, "Y"))
        bmesh.ops.translate(b, verts=b.verts, vec=Vector((cx, Y + 0.08, cz + 0.08)))
        m.add_bm(b, TIMBER)
    return m


UW = W + 2 * OVER
MODELS = [
    seg1(), seg2(),
    end_cap("otto1_end", X + 0.55, LOW, 1.5, X, LOW),
    end_cap("otto2_end", UW / 2 + 0.5, LOW + UP, 1.7, UW / 2, LOW + UP),
]
print("OTTOMAN_OK", write_json(MODELS, OUT))
if PREVIEW:
    preview(MODELS, PREVIEW, spacing=8, res=(1100, 420), cam_z=3.8, elev=76, scale_pad=6)
    print("PREVIEW_OK")
