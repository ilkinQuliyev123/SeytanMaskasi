"""Blender (bpy): low-poly yapon kənd evləri (minka) — irimoya kirəmit dam və qalın saman dam (kayabuki).

  blender --background --factory-startup --python tools/blender/houses.py -- <çıxış.json> [önizləmə.png]

Ölçü (oyun metri): bünövrə 7.5×6 (X uzun, Y dərin), ön tərəf -Y (oyunda -Z), daş bünövrə 0.5 m, divar 3 m.
Oyun evi w/7.5 × dd/6 miqyaslayır (world.ts → buildHamlets).
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Model, hexrgb, jitter, write_json, preview
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGV[0] if ARGV else "houses.json"
PREVIEW = ARGV[1] if len(ARGV) > 1 else None

W, D = 7.5, 6.0          # divar bünövrəsi
BASE, WALL = 0.5, 3.0    # daş bünövrə, divar hündürlüyü
X, Y = W / 2, D / 2
TOP = BASE + WALL

STONE, WOOD, DARK, PLASTER, SHOJI = "#7a766c", "#5a3a26", "#33231a", "#e8e0cc", "#efe6cf"
TILE, TILE_RIDGE, THATCH, THATCH_DARK = "#3b4048", "#24272c", "#a08a5a", "#6a5a3a"


def frame(m: Model):
    """daş bünövrə, divarlar (alt taxta, üst suvaq), dirəklər, tirlər, ön sürgü qapılar, engawa"""
    m.box((W + 0.6, D + 0.6, BASE + 1.5), (0, 0, (BASE - 1.5) / 2), STONE, var=0.08)  # 1.5 m torpağa batır (yamacda boşluq qalmasın)
    # divar gövdəsi: aşağı taxta panel, yuxarı suvaq
    m.box((W, D, 1.2), (0, 0, BASE + 0.6), WOOD)
    m.box((W - 0.02, D - 0.02, WALL - 1.2), (0, 0, BASE + 1.2 + (WALL - 1.2) / 2), PLASTER, var=0.03)
    # dirəklər (künc + ara), tirlər
    xs = [-X + i * (W / 4) for i in range(5)]
    for x in xs:
        for y in (-Y, Y):
            m.box((0.22, 0.22, WALL + 0.1), (x, y, BASE + WALL / 2), DARK)
    for y in (-Y + D / 3, Y - D / 3):
        for x in (-X, X):
            m.box((0.22, 0.22, WALL + 0.1), (x, y, BASE + WALL / 2), DARK)
    for z in (BASE + 1.2, TOP - 0.1):
        m.box((W + 0.1, 0.16, 0.16), (0, -Y - 0.02, z), DARK)
        m.box((W + 0.1, 0.16, 0.16), (0, Y + 0.02, z), DARK)
        m.box((0.16, D + 0.1, 0.16), (-X - 0.02, 0, z), DARK)
        m.box((0.16, D + 0.1, 0.16), (X + 0.02, 0, z), DARK)
    # ön tərəf: 2 cüt sürgü qapı (shoji) — açıq rəngli panel + qəfəs
    for cx in (-W / 4, W / 4):
        m.box((W / 4 - 0.35, 0.06, 2.0), (cx, -Y - 0.06, BASE + 1.05), SHOJI, var=0.02)
        for k in (-1, 0, 1):
            m.box((0.05, 0.08, 2.0), (cx + k * (W / 4 - 0.35) / 3, -Y - 0.09, BASE + 1.05), DARK)
        for z in (0.55, 1.05, 1.55):
            m.box((W / 4 - 0.35, 0.08, 0.05), (cx, -Y - 0.09, BASE + z), DARK)
    # engawa (taxta veranda) + pillə
    m.box((W + 0.4, 1.1, 0.14), (0, -Y - 0.65, BASE + 0.05), WOOD)
    m.box((W * 0.4, 0.5, 0.25), (0, -Y - 1.45, 0.2), STONE)


def irimoya(m: Model, over=1.25, rise=2.9, ridge_k=0.42, gable=0.55, thick=0.22, color=TILE, ridge_color=TILE_RIDGE,
            upturn=0.28, fascia=WOOD):
    """yarım-kalça (irimoya) dam: alt hissə 4 tərəfə enir, yuxarıda üçbucaq alınlıq; künclər yuxarı qalxır"""
    e = TOP + 0.05                      # saçaq hündürlüyü
    t = e + rise                        # tin (ridge)
    ex, ey = X + over, Y + over
    rx = ex * ridge_k                   # tinin yarı uzunluğu
    g = e + rise * gable                # alınlığın başladığı hündürlük
    hy = ey * (t - g) / (t - e)         # uzun dam müstəvisində g hündürlüyündə y
    up = lambda sx, sy: (sx * (ex + 0.15), sy * (ey + 0.1), e + upturn)  # yuxarı qalxan künclər
    E = {(sx, sy): up(sx, sy) for sx in (-1, 1) for sy in (-1, 1)}
    H = {(sx, sy): (sx * rx, sy * hy, g) for sx in (-1, 1) for sy in (-1, 1)}
    R = {sx: (sx * rx, 0, t) for sx in (-1, 1)}
    faces = []
    for sy in (-1, 1):  # uzun yamaclar
        f = [E[(-1, sy)], E[(1, sy)], H[(1, sy)], R[1], R[-1], H[(-1, sy)]]
        faces.append(f if sy < 0 else list(reversed(f)))
    for sx in (-1, 1):  # qısa (kalça) yamaclar
        f = [E[(sx, -1)], E[(sx, 1)], H[(sx, 1)], H[(sx, -1)]]
        faces.append(list(reversed(f)) if sx < 0 else f)
    # ön/arxa normallar xaricə baxsın deyə sıranı Blender özü düzəltsin
    m.poly(faces, lambda f, c: jitter(hexrgb(color) * (0.82 + 0.3 * max(0, f.normal.z)), m.rnd, 0.04))
    # alınlıq (gable) üçbucaqları — taxta
    for sx in (-1, 1):
        tri = [H[(sx, -1)], H[(sx, 1)], R[sx]]
        m.poly([tri if sx > 0 else list(reversed(tri))], fascia)
    # saçağın altı (soffit) + qalınlıq (fascia)
    lo = [(p[0], p[1], p[2] - thick) for p in (E[(-1, -1)], E[(1, -1)], E[(1, 1)], E[(-1, 1)])]
    m.poly([list(reversed(lo))], DARK)
    ring = [E[(-1, -1)], E[(1, -1)], E[(1, 1)], E[(-1, 1)]]
    side = []
    for i in range(4):
        a, b = ring[i], ring[(i + 1) % 4]
        la, lb = lo[i], lo[(i + 1) % 4]
        side.append([la, lb, b, a])
    m.poly(side, fascia)
    # tin örtüyü + uclarında oni-gawara
    m.box((2 * rx + 0.6, 0.45, 0.32), (0, 0, t + 0.05), ridge_color)
    for sx in (-1, 1):
        m.box((0.35, 0.6, 0.55), (sx * (rx + 0.3), 0, t + 0.15), ridge_color)


def kayabuki(m: Model):
    """qalın saman dam: dik, qalın kənar, tində tünd «at yəhəri» örtük"""
    irimoya(m, over=1.0, rise=3.9, ridge_k=0.5, gable=0.62, thick=0.6, color=THATCH, ridge_color=THATCH_DARK,
            upturn=0.0, fascia=THATCH_DARK)
    # tində saman dəstələri (köndələn çubuqlar)
    for i in range(-3, 4):
        m.box((0.18, 1.1, 0.18), (i * 0.85, 0, TOP + 0.05 + 3.9 + 0.12), DARK)


def house(name, roof, seed):
    m = Model(name, seed)
    frame(m)
    roof(m)
    return m


MODELS = [house("minka", irimoya, 1), house("kayabuki", kayabuki, 2)]
print("HOUSES_OK", write_json(MODELS, OUT))
if PREVIEW:
    preview(MODELS, PREVIEW, spacing=13, res=(1000, 420), cam_z=3.5, elev=74, scale_pad=10)
    print("PREVIEW_OK")
