"""Blender skriptləri üçün ümumi low-poly köməkçilər: üçbucaq toplayıcı, rəng, qutu, JSON ixracı, önizləmə."""
import bpy, bmesh, json, math, random
from mathutils import Vector, Matrix, Color


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
    """Üçbucaq toplayıcı: hər üzün öz rəngi və normalı (flat low-poly)."""

    def __init__(self, name, seed=0):
        self.name, self.tris, self.rnd = name, [], random.Random(seed)

    def add_bm(self, bm, color, var=0.05, sky=0.18):
        """color: hex və ya fn(face, center)->Vector"""
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        base = hexrgb(color) if isinstance(color, str) else None
        for f in bm.faces:
            vs = [v.co.copy() for v in f.verts]
            if base is not None:
                c = base * (1 - sky + sky * (0.5 + 0.5 * f.normal.z))
                c = jitter(c, self.rnd, var)
            else:
                c = color(f, sum(vs, Vector()) / 3)
            self.tris.append((vs, c, f.normal.copy()))
        bm.free()
        return self

    def box(self, size, center, color, rot_z=0.0, var=0.05):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        if rot_z:
            bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(rot_z, 3, "Z"))
        bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
        return self.add_bm(bm, color, var)

    def poly(self, faces_pts, color, var=0.05):
        """faces_pts: [[(x,y,z),...], ...] — hər biri bir çoxbucaqlı üz"""
        bm = bmesh.new()
        for pts in faces_pts:
            vs = [bm.verts.new(p) for p in pts]
            bm.faces.new(vs)
        return self.add_bm(bm, color, var)

    def export(self):
        pos, col, nor = [], [], []
        for vs, c, n in self.tris:
            for v in vs:
                pos += [round(v.x, 3), round(v.z, 3), round(v.y, 3)]  # Blender Z yuxarı → oyun Y yuxarı
            nor += [round(n.x, 2), round(n.z, 2), round(n.y, 2)]
            col += [int(max(0, min(1, x)) * 255 + 0.5) for x in c[:3]]
        return {"p": pos, "n": nor, "c": col, "tris": len(self.tris)}


def write_json(models, path):
    data = {m.name: m.export() for m in models}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    return {k: v["tris"] for k, v in data.items()}


def preview(models, path, spacing=12.0, res=(1400, 360), cam_z=5.0, elev=78, scale_pad=6):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    x = 0.0
    for mdl in models:
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
        ob.rotation_euler.z = math.radians(-28)
        x += spacing
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    sh = scn.display.shading
    sh.light, sh.color_type, sh.show_shadows = "STUDIO", "VERTEX", True
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scn.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = x + scale_pad - spacing
    cam.location = ((x - spacing) / 2, -60, cam_z + 60 * math.tan(math.radians(90 - elev)))
    cam.rotation_euler = (math.radians(elev), 0, 0)
    scn.camera = cam
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
