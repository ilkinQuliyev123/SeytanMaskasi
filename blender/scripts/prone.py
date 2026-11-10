# Uzanaraq atəş pozası (Prone_Loop) — UAL skeleti üçün. İşlət: blender -b soldiers.blend --python prone.py -- <çıxış.glb> [önizləmə.png]
import bpy, math, sys
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else None; PNG = argv[1] if len(argv) > 1 else None
rig = bpy.data.objects["RigSH"]
for o in bpy.data.objects:
    o.hide_set(o.name in ("Enemy_Body", "Gear_Enemy", "Body_orig"))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
P = rig.pose.bones
def upd(): bpy.context.view_layer.update()
def reset():
    for pb in P: pb.matrix_basis = Matrix.Identity(4)
    upd()
def setm(b, M): P[b].matrix = M; upd()
def aim(b, target, ref=None):
    pb = P[b]; upd(); head = pb.head.copy(); cur = pb.matrix.to_3x3(); dcur = (pb.tail - pb.head).normalized()
    d1 = (Vector(target) - head).normalized()
    M = (dcur.rotation_difference(d1).to_matrix() @ cur).to_4x4(); M.translation = head; setm(b, M)
def pose(breath=0.0, recoil=0.0):
    reset()
    rest = P["pelvis"].bone.matrix_local.copy()
    M = Matrix.Rotation(math.radians(90), 4, 'X') @ rest; M.translation = Vector((0, 0.5, 0.16 + breath * 0.006)); setm("pelvis", M)
    # ayaqlar: geriyə, bir az aralı, barmaq ucları yerdə
    for s, x in (("l", 0.2), ("r", -0.2)):
        th = P["thigh_" + s].head
        aim("thigh_" + s, (x * 1.0, th.y + 0.45, 0.1))
        ca = P["calf_" + s].head; aim("calf_" + s, (x * 1.25, ca.y + 0.45, 0.08))
        fo = P["foot_" + s].head; aim("foot_" + s, (x * 1.25, fo.y + 0.03, -0.1))
    # bel: başa doğru bir az qalxır (dirsəklər üstündə)
    sp = P["spine_02"].head; aim("spine_02", (0, sp.y - 0.2, sp.z + 0.04))
    sp = P["spine_03"].head; aim("spine_03", (0, sp.y - 0.2, sp.z + 0.09))
    nk = P["neck_01"].head; aim("neck_01", (0, nk.y - 0.035, nk.z + 0.1))
    hd = P["Head"].head; aim("Head", (0, hd.y + 0.012, hd.z + 0.1))  # baş dik — üz irəli baxır
    # qollar: dirsəklər yerdə, əllər qabaqda — tüfəngi tutur (sağ əl qundaqda, sol əl ön ağacda)
    sh_r = P["upperarm_r"].head; sh_l = P["upperarm_l"].head
    elb_r = Vector((-0.2, sh_r.y - 0.12, 0.05)); elb_l = Vector((0.24, sh_l.y - 0.28, 0.05))
    aim("upperarm_r", elb_r); aim("upperarm_l", elb_l)
    hr = Vector((-0.06, elb_r.y - 0.22 + recoil * 0.03, 0.2 + recoil * 0.02)); hl = Vector((0.04, elb_l.y - 0.22, 0.16))
    aim("lowerarm_r", hr); aim("lowerarm_l", hl)
    for s, t in (("r", Vector((-0.04, hr.y - 0.1, hr.z))), ("l", Vector((0.03, hl.y - 0.1, hl.z)))):
        aim("hand_" + s, t)
    print("head", tuple(round(c, 2) for c in P["Head"].head), "handR", tuple(round(c, 2) for c in P["hand_r"].head))
act = bpy.data.actions.get("Prone_Loop") or bpy.data.actions.new("Prone_Loop")
rig.animation_data_create(); rig.animation_data.action = act
for f, (b, r) in ((1, (0, 0)), (20, (1, 0)), (40, (0, 0))):
    pose(b, r)
    for pb in P:
        pb.keyframe_insert("location", frame=f); pb.keyframe_insert("rotation_quaternion", frame=f)
act.use_fake_user = True
bpy.context.scene.frame_start = 1; bpy.context.scene.frame_end = 40
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.scene.frame_set(1)
if PNG:
    sc = bpy.context.scene
    cam = bpy.data.objects.get("PrevCam") or bpy.data.objects.new("PrevCam", bpy.data.cameras.new("PrevCam"))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    cam.location = (2.6, -1.4, 1.2); cam.rotation_euler = (math.radians(70), 0, math.radians(62)); sc.camera = cam
    try: sc.render.engine = 'BLENDER_WORKBENCH'
    except TypeError: pass
    sc.display.shading.color_type = 'VERTEX'
    sc.render.resolution_x = 640; sc.render.resolution_y = 400; sc.render.filepath = PNG
    bpy.ops.render.render(write_still=True)
if OUT:
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_skins=True, export_materials='NONE')
    keys = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    for k, v in (('export_animation_mode', 'ACTIONS'), ('export_force_sampling', True), ('export_def_bones', False)):
        if k in keys: kw[k] = v
    bpy.ops.export_scene.gltf(**kw)
    bpy.ops.wm.save_mainfile()
print("DONE")
