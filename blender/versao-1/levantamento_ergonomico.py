"""
Levantamento correto de carga (ergonomia) - Blender 4.x / 5.x
Gera: boneco com esqueleto (IK), caixa, câmera, luzes, textos e animação.

Uso dentro do Blender: aba Scripting > Abrir este arquivo > Run Script.
Uso por linha de comando:
    blender -b -P levantamento_ergonomico.py -- --out ./saida [--render]
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion, Euler

# ---------------------------------------------------------------- argumentos
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(os.getcwd(), "saida")
RENDER = "--render" in argv
PREVIEW = [int(f) for f in argv[argv.index("--preview") + 1].split(",")] if "--preview" in argv else []
os.makedirs(OUT, exist_ok=True)

FPS = 30
FRAME_END = 240

# ---------------------------------------------------------------- limpa cena
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, FRAME_END


def mat(name, color, rough=0.5, emit=None, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit[0], 1)
        bsdf.inputs["Emission Strength"].default_value = emit[1]
    m.diffuse_color = (*color, 1)  # cor no viewport / Unity
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


M_SHIRT = mat("Camisa", srgb("#1f6fd1"), 0.6)
M_PANTS = mat("Calca", srgb("#2a2f3a"), 0.7)
M_SKIN = mat("Pele", srgb("#c99673"), 0.55)
M_SHOE = mat("Botina", srgb("#1a1a1a"), 0.5)
M_GLOVE = mat("Luva", srgb("#e0892b"), 0.7)
M_HELMET = mat("Capacete", srgb("#f2c014"), 0.3)
M_EYE = mat("Olhos", srgb("#111111"), 0.2)
M_VEST = mat("Faixa", srgb("#d8ff3a"), 0.4, emit=(srgb("#d8ff3a"), 0.6))
MATS = [M_SHIRT, M_PANTS, M_SKIN, M_SHOE, M_GLOVE, M_HELMET, M_EYE, M_VEST]

# ---------------------------------------------------------------- esqueleto
# Personagem olha para -Y. Lado esquerdo (.L) = +X.
BONES = [
    # nome, cabeça, cauda, pai, conectado, deform
    ("root", (0, 0, 0), (0, 0.25, 0), None, False, False),
    ("hips", (0, 0, 0.95), (0, 0, 1.07), "root", False, True),
    ("spine", (0, 0, 1.07), (0, 0, 1.28), "hips", True, True),
    ("chest", (0, 0, 1.28), (0, 0, 1.48), "spine", True, True),
    ("neck", (0, 0, 1.48), (0, 0, 1.56), "chest", True, True),
    ("head", (0, 0, 1.56), (0, 0, 1.80), "neck", True, True),
]
for s, x in (("L", 1), ("R", -1)):
    BONES += [
        (f"upperarm.{s}", (0.21 * x, 0, 1.45), (0.21 * x, 0.025, 1.16), "chest", False, True),
        (f"forearm.{s}", (0.21 * x, 0.025, 1.16), (0.21 * x, 0, 0.90), f"upperarm.{s}", True, True),
        (f"hand.{s}", (0.21 * x, 0, 0.90), (0.21 * x, 0, 0.80), f"forearm.{s}", True, True),
        (f"thigh.{s}", (0.10 * x, 0, 0.93), (0.10 * x, -0.025, 0.50), "hips", False, True),
        (f"shin.{s}", (0.10 * x, -0.025, 0.50), (0.10 * x, 0, 0.08), f"thigh.{s}", True, True),
        (f"foot.{s}", (0.10 * x, 0, 0.08), (0.10 * x, -0.16, 0.03), f"shin.{s}", True, True),
        # controles (não exportam como deform)
        (f"foot_ik.{s}", (0.10 * x, 0, 0.08), (0.10 * x, -0.16, 0.03), "root", False, False),
        (f"knee_pole.{s}", (0.10 * x, -0.6, 0.5), (0.10 * x, -0.7, 0.5), "root", False, False),
        (f"hand_ik.{s}", (0.21 * x, 0, 0.90), (0.21 * x, 0, 0.80), "root", False, False),
        (f"elbow_pole.{s}", (0.40 * x, 0.6, 1.15), (0.40 * x, 0.7, 1.15), "root", False, False),
    ]

arm_data = bpy.data.armatures.new("Rig")
arm = bpy.data.objects.new("Trabalhador_Rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
arm_data.display_type = "STICK"
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t, parent, conn, deform in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail, eb.roll = Vector(h), Vector(t), 0.0
    eb.use_deform = deform
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = conn
bpy.ops.object.mode_set(mode="OBJECT")

pb = arm.pose.bones
for b in pb:
    b.rotation_mode = "QUATERNION"

# restrições IK
for s in ("L", "R"):
    for owner, tgt, pole in ((f"shin.{s}", f"foot_ik.{s}", f"knee_pole.{s}"),
                             (f"forearm.{s}", f"hand_ik.{s}", f"elbow_pole.{s}")):
        c = pb[owner].constraints.new("IK")
        c.name = "IK"
        c.target, c.subtarget = arm, tgt
        c.pole_target, c.pole_subtarget = arm, pole
        c.chain_count = 2
    for owner, tgt in ((f"foot.{s}", f"foot_ik.{s}"), (f"hand.{s}", f"hand_ik.{s}")):
        c = pb[owner].constraints.new("COPY_ROTATION")
        c.name = "CopyRot"
        c.target, c.subtarget = arm, tgt


def calibrate_pole(owner, joint_bone):
    """Escolhe o pole_angle que mantém a pose de descanso intacta."""
    c = pb[owner].constraints["IK"]
    rest = arm_data.bones[joint_bone].tail_local.copy()
    best = None
    for deg in range(-180, 181, 5):
        c.pole_angle = math.radians(deg)
        bpy.context.view_layer.update()
        err = (pb[joint_bone].tail - rest).length
        if best is None or err < best[0]:
            best = (err, deg)
    c.pole_angle = math.radians(best[1])
    return best


for s in ("L", "R"):
    calibrate_pole(f"shin.{s}", f"thigh.{s}")
    calibrate_pole(f"forearm.{s}", f"upperarm.{s}")

# ---------------------------------------------------------------- malha do boneco
mesh = bpy.data.meshes.new("Trabalhador")
body = bpy.data.objects.new("Trabalhador", mesh)
scene.collection.objects.link(body)
for m in MATS:
    mesh.materials.append(m)
deform_names = [b[0] for b in BONES if b[5]]
for n in deform_names:
    body.vertex_groups.new(name=n)

bm = bmesh.new()
dl = bm.verts.layers.deform.verify()


def _finish(verts, bone, m, smooth=True):
    gi = body.vertex_groups[bone].index
    mi = MATS.index(m)
    for v in verts:
        v[dl][gi] = 1.0
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mi
        f.smooth = smooth


def _place(verts, p1, p2, scale=(1, 1, 1)):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4() if d.length > 1e-6 else Matrix()
    mid = (p1 + p2) / 2
    M = Matrix.Translation(mid) @ Matrix.Diagonal((*scale, 1)) @ rot
    bmesh.ops.transform(bm, matrix=M, verts=verts)


def capsule(p1, p2, r, bone, m, scale=(1, 1, 1), seg=20):
    L = (Vector(p2) - Vector(p1)).length
    verts = []
    res = bmesh.ops.create_cone(bm, cap_ends=False, segments=seg, radius1=r, radius2=r, depth=L)
    verts += res["verts"]
    for z in (-L / 2, L / 2):
        sp = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=10, radius=r)
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=sp["verts"])
        verts += sp["verts"]
    _place(verts, p1, p2, scale)
    _finish(verts, bone, m)


def sphere(c, r, bone, m, scale=(1, 1, 1)):
    sp = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=r)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*scale, 1)), verts=sp["verts"])
    _finish(sp["verts"], bone, m)


def cyl(p1, p2, r1, r2, bone, m, seg=24):
    L = (Vector(p2) - Vector(p1)).length
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=L)
    _place(res["verts"], p1, p2)
    _finish(res["verts"], bone, m)


# tronco
capsule((-0.10, 0, 0.93), (0.10, 0, 0.93), 0.11, "hips", M_PANTS, scale=(1, 0.85, 1))
capsule((0, 0, 1.03), (0, 0, 1.24), 0.125, "spine", M_SHIRT, scale=(1.05, 0.78, 1))
capsule((0, 0, 1.28), (0, 0, 1.40), 0.15, "chest", M_SHIRT, scale=(1, 0.72, 1))
capsule((-0.19, 0, 1.44), (0.19, 0, 1.44), 0.065, "chest", M_SHIRT)
cyl((0, 0, 1.16), (0, 0, 1.20), 0.133, 0.133, "spine", M_VEST)  # faixa refletiva
cyl((0, 0, 1.47), (0, 0, 1.58), 0.05, 0.048, "neck", M_SKIN)
sphere((0, -0.01, 1.665), 0.105, "head", M_SKIN, scale=(1, 1.02, 1.15))
for x in (0.04, -0.04):
    sphere((x, -0.10, 1.68), 0.014, "head", M_EYE)
# capacete
hel = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=0.125)
lower = [v for v in hel["verts"] if v.co.z < -0.001]
bmesh.ops.delete(bm, geom=lower, context="VERTS")
hv = [v for v in hel["verts"] if v.is_valid]
bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0.0, 1.70)) @ Matrix.Diagonal((1, 1.08, 0.9, 1)), verts=hv)
_finish(hv, "head", M_HELMET)
cyl((0, -0.02, 1.695), (0, -0.02, 1.705), 0.15, 0.15, "head", M_HELMET)
# membros
for s, x in (("L", 1), ("R", -1)):
    capsule((0.21 * x, 0, 1.44), (0.21 * x, 0.025, 1.17), 0.052, f"upperarm.{s}", M_SHIRT)
    capsule((0.21 * x, 0.025, 1.15), (0.21 * x, 0, 0.92), 0.042, f"forearm.{s}", M_SKIN)
    capsule((0.21 * x, 0, 0.885), (0.21 * x, -0.005, 0.82), 0.042, f"hand.{s}", M_GLOVE, scale=(0.75, 1, 1))
    capsule((0.10 * x, 0, 0.90), (0.10 * x, -0.025, 0.51), 0.075, f"thigh.{s}", M_PANTS)
    capsule((0.10 * x, -0.025, 0.49), (0.10 * x, 0, 0.12), 0.058, f"shin.{s}", M_PANTS)
    capsule((0.10 * x, 0.03, 0.05), (0.10 * x, -0.15, 0.045), 0.05, f"foot.{s}", M_SHOE, scale=(1, 1, 0.8))

bm.to_mesh(mesh)
bm.free()
body.parent = arm
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = arm

# ---------------------------------------------------------------- caixa
BOX = Vector((0.34, 0.32, 0.36))
box_mesh = bpy.data.meshes.new("Caixa")
bmb = bmesh.new()
bmesh.ops.create_cube(bmb, size=1.0)
bmesh.ops.scale(bmb, vec=BOX, verts=bmb.verts)
bmesh.ops.bevel(bmb, geom=list(bmb.edges), offset=0.008, segments=2, affect="EDGES")
bmb.to_mesh(box_mesh)
bmb.free()
box = bpy.data.objects.new("Caixa", box_mesh)
scene.collection.objects.link(box)
box_mesh.materials.append(mat("Papelao", srgb("#b07a45"), 0.85))
tape_mesh = bpy.data.meshes.new("Fita")
bmt = bmesh.new()
bmesh.ops.create_cube(bmt, size=1.0)
bmesh.ops.scale(bmt, vec=(0.07, BOX.y + 0.004, 0.004), verts=bmt.verts)
bmesh.ops.translate(bmt, vec=(0, 0, BOX.z / 2), verts=bmt.verts)
bmt.to_mesh(tape_mesh)
bmt.free()
tape = bpy.data.objects.new("Fita", tape_mesh)
tape_mesh.materials.append(mat("FitaMat", srgb("#8a5a2b"), 0.4))
scene.collection.objects.link(tape)
tape.parent = box

# ---------------------------------------------------------------- animação
REST3 = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
REST_HEAD = {b.name: b.head_local.copy() for b in arm_data.bones}


def key(bone, frame, delta=(0, 0, 0), rot=(0, 0, 0)):
    """delta e rot (graus, eixos X/Y/Z globais) no espaço do mundo."""
    p = pb[bone]
    M = REST3[bone]
    p.location = M.inverted() @ Vector(delta)
    R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
    p.rotation_quaternion = (M.inverted() @ R @ M).to_quaternion()
    p.keyframe_insert("location", frame=frame)
    p.keyframe_insert("rotation_quaternion", frame=frame)


def key_world(bone, frame, pos, rot=(0, 0, 0)):
    key(bone, frame, Vector(pos) - REST_HEAD[bone], rot)


# --- quadril / tronco: agacha com a coluna neutra (inclina só no quadril)
SQUAT = dict(delta=(0, 0.11, -0.50), rot=(38, 0, 0))
for f in (0, 20, 40):
    key("hips", f)
key("hips", 66, delta=(0, 0.07, -0.30), rot=(26, 0, 0))
key("hips", 92, **SQUAT)
key("hips", 115, **SQUAT)
key("hips", 145, delta=(0, 0.07, -0.26), rot=(28, 0, 0))
key("hips", 178)
key("hips", 240)
# pescoço/cabeça compensam para olhar à frente
for f, a in ((0, 0), (40, 0), (92, -22), (115, -22), (145, -14), (178, 0), (240, 0)):
    key("neck", f, rot=(a * 0.5, 0, 0))
    key("head", f, rot=(a * 0.5, 0, 0))
for b in ("spine", "chest", "root"):
    key(b, 0)

# --- pés: afasta na largura dos ombros, um pé levemente à frente
FEET = {
    "R": [(0, (-0.10, 0, 0.08), 0), (18, (-0.10, 0, 0.08), 0), (24, (-0.17, 0.02, 0.14), -5),
          (30, (-0.24, 0.04, 0.08), -10), (240, (-0.24, 0.04, 0.08), -10)],
    "L": [(0, (0.10, 0, 0.08), 0), (28, (0.10, 0, 0.08), 0), (34, (0.17, -0.04, 0.14), 5),
          (40, (0.24, -0.08, 0.08), 10), (240, (0.24, -0.08, 0.08), 10)],
}
for s, keys in FEET.items():
    for f, pos, yaw in keys:
        key_world(f"foot_ik.{s}", f, pos, rot=(0, 0, yaw))
    x = 1 if s == "L" else -1
    key(f"knee_pole.{s}", 0)
    key(f"knee_pole.{s}", 30)
    key(f"knee_pole.{s}", 60, delta=(0.30 * x, 0, 0))
    key(f"knee_pole.{s}", 150, delta=(0.30 * x, 0, 0))
    key(f"knee_pole.{s}", 200)
    key(f"elbow_pole.{s}", 0)

# --- caixa e mãos (mesmos quadros-chave => movimentos idênticos)
BOX_Y = -0.33
BOX_PATH = [(0, (0, BOX_Y, BOX.z / 2)), (115, (0, BOX_Y, BOX.z / 2)),
            (145, (0, -0.32, 0.50)), (178, (0, -0.30, 0.86)), (240, (0, -0.30, 0.86))]
GRIP = Vector((BOX.x / 2 + 0.028, 0, 0.14))  # punho relativo ao centro da caixa
for f, pos in BOX_PATH:
    box.location = pos
    box.keyframe_insert("location", frame=f)
    for s, x in (("L", 1), ("R", -1)):
        key_world(f"hand_ik.{s}", f, Vector(pos) + Vector((GRIP.x * x, GRIP.y, GRIP.z)))

# braços: FK solto até alcançar a caixa, depois IK na caixa
for s in ("L", "R"):
    for cname, owner in (("IK", f"forearm.{s}"), ("CopyRot", f"hand.{s}")):
        c = pb[owner].constraints[cname]
        for f, v in ((0, 0.0), (56, 0.0), (94, 1.0), (240, 1.0)):
            c.influence = v
            c.keyframe_insert("influence", frame=f)

# interpolação suave (ease in/out) em tudo
for ad in (arm.animation_data, box.animation_data):
    act = ad.action
    curves = []
    if hasattr(act, "fcurves"):
        curves = list(act.fcurves)
    if not curves:  # Blender 5: actions em camadas/slots
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    curves += list(cb.fcurves)
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
        fc.update()

arm.animation_data.action.name = "Levantamento_Correto"

# ---------------------------------------------------------------- linha "coluna reta"
guide_mesh = bpy.data.meshes.new("GuiaColuna")
bmg = bmesh.new()
res = bmesh.ops.create_cone(bmg, cap_ends=True, segments=12, radius1=0.009, radius2=0.009, depth=0.58)
bmesh.ops.translate(bmg, vec=(0, 0.135, 1.24), verts=res["verts"])
for z in (0.95, 1.53):
    sp = bmesh.ops.create_uvsphere(bmg, u_segments=12, v_segments=8, radius=0.02)
    bmesh.ops.translate(bmg, vec=(0, 0.135, z), verts=sp["verts"])
bmg.to_mesh(guide_mesh)
bmg.free()
guide = bpy.data.objects.new("GuiaColuna", guide_mesh)
guide_mesh.materials.append(mat("Ciano", srgb("#22e3ff"), 0.3, emit=(srgb("#22e3ff"), 6)))

# ---------------------------------------------------------------- cenário (só render)
fx = bpy.data.collections.new("Cenario_Render")
scene.collection.children.link(fx)
fx.objects.link(guide)
hb = arm_data.bones["hips"]
guide.parent, guide.parent_type, guide.parent_bone = arm, "BONE", "hips"
tail_m = arm.matrix_world @ hb.matrix_local @ Matrix.Translation((0, hb.length, 0))
guide.matrix_parent_inverse = tail_m.inverted()

floor_mesh = bpy.data.meshes.new("Piso")
bmf = bmesh.new()
bmesh.ops.create_grid(bmf, x_segments=1, y_segments=1, size=12)
bmf.to_mesh(floor_mesh)
bmf.free()
floor = bpy.data.objects.new("Piso", floor_mesh)
fm = mat("PisoMat", srgb("#161a21"), 0.7)
floor_mesh.materials.append(fm)
fx.objects.link(floor)

world = bpy.data.worlds.new("Mundo")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#0b0f15"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0


def light(name, kind, loc, rot, energy, color=(1, 1, 1), size=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, color
    if kind == "AREA":
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    o.location, o.rotation_euler = loc, [math.radians(a) for a in rot]
    fx.objects.link(o)
    return o


light("Key", "AREA", (2.6, -1.8, 3.0), (45, 0, 55), 380, size=1.6)
light("Fill", "AREA", (-3.0, -2.0, 2.0), (60, 0, -55), 120, (0.8, 0.9, 1.0), size=3)
light("Rim", "AREA", (-1.6, 1.6, 2.4), (-50, 0, 225), 260, srgb("#5fe8ff"), size=1.0)

cam_d = bpy.data.cameras.new("Camera")
cam_d.lens = 40
cam = bpy.data.objects.new("Camera", cam_d)
fx.objects.link(cam)
cam.location = (4.4, -1.25, 1.05)
target = Vector((0, -0.12, 0.74))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# ---------------------------------------------------------------- textos
FONT = None
for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/segoeuib.ttf",
          "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
    if os.path.exists(p):
        FONT = bpy.data.fonts.load(p)
        break
M_TXT = mat("Texto", (1, 1, 1), 0.5, emit=((1, 1, 1), 1.2))
M_TXT2 = mat("TextoCiano", srgb("#22e3ff"), 0.5, emit=(srgb("#22e3ff"), 2.5))
M_TXT3 = mat("TextoCinza", srgb("#9aa6b8"), 0.5, emit=(srgb("#9aa6b8"), 0.9))
DIST = 3.0
half_w = DIST * 18 / cam_d.lens  # metade da largura do quadro na distância DIST


def text(body_txt, x, y, size, m, name):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body_txt
    cu.size = size
    if FONT:
        cu.font = FONT
    o = bpy.data.objects.new(name, cu)
    cu.materials.append(m)
    o.parent = cam
    o.location = (x, y, -DIST)
    fx.objects.link(o)
    return o


hh = half_w * 9 / 16
L = -half_w + 0.12
text("LEVANTAMENTO CORRETO DE CARGA", L, hh - 0.20, 0.085, M_TXT, "Titulo")
text("ERGONOMIA NO TRABALHO", L, hh - 0.30, 0.05, M_TXT2, "Subtitulo")

STEPS = [
    (0, 18, "Posicione-se de frente e perto da carga"),
    (18, 44, "1 · Afaste os pés na largura dos ombros"),
    (44, 94, "2 · Agache dobrando os joelhos — coluna reta"),
    (94, 117, "3 · Segure firme com as duas mãos"),
    (117, 180, "4 · Levante com a força das pernas"),
    (180, FRAME_END + 1, "5 · Carga junto ao corpo, sem torcer o tronco"),
]
for i, (a, b, t) in enumerate(STEPS):
    o = text(t, L, -hh + 0.16, 0.068, M_TXT, f"Passo_{i}")
    for f, hide in ((0, True), (a, False), (b, True)):
        if f == 0 and a == 0:
            continue
        o.hide_render = o.hide_viewport = hide
        o.keyframe_insert("hide_render", frame=f)
        o.keyframe_insert("hide_viewport", frame=f)
    if a == 0:
        o.hide_render = o.hide_viewport = False
        o.keyframe_insert("hide_render", frame=0)
        o.keyframe_insert("hide_viewport", frame=0)
text("Mantenha a coluna neutra (linha ciano) durante todo o movimento", L, -hh + 0.07, 0.04, M_TXT3, "Dica")

scene.frame_set(0)

# ---------------------------------------------------------------- render
r = scene.render
r.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 12
scene.cycles.max_bounces = 4
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
r.resolution_x, r.resolution_y, r.resolution_percentage = 1280, 720, 75
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

# ---------------------------------------------------------------- salvar / exportar
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "levantamento_correto.blend"))

bpy.ops.object.select_all(action="DESELECT")
for o in (arm, body, box, tape):
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.fbx(
    filepath=os.path.join(OUT, "levantamento_correto.fbx"),
    use_selection=True, object_types={"ARMATURE", "MESH"},
    apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y",
    add_leaf_bones=False, use_armature_deform_only=True,
    bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
    bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0,
)

for f in PREVIEW:
    scene.frame_set(f)
    r.filepath = os.path.join(OUT, f"preview_{f:03d}.png")
    bpy.ops.render.render(write_still=True)

if RENDER:
    r.filepath = os.path.join(OUT, "frames", "f_")
    r.image_settings.file_format = "PNG"
    bpy.ops.render.render(animation=True)

print("OK ->", OUT)
