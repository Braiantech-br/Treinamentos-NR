"""
Treinamento: Levantamento Seguro de Cargas — Braian Tech
Cena 3D (Blender 4.x/5.x): galpão, trabalhador com EPI, jeito ERRADO e jeito CERTO.

  blender -b -P cena_pro.py -- --out ./saida_pro [--preview 120,500] [--render] [--res 100]
"""
import bpy, bmesh, math, sys, os, json
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = os.path.abspath(arg("--out", "saida_pro"))
PREVIEW = [int(f) for f in arg("--preview", "").split(",") if f]
RENDER = "--render" in argv
RES = int(arg("--res", "100"))
SAMPLES = int(arg("--samples", "12"))
os.makedirs(OUT, exist_ok=True)

FPS = 24
def T(s): return int(round(s * FPS))

# trechos com cena 3D (o resto são cartelas 2D)
SEG_3D = [(0.0, 11.0), (13.0, 36.5)]
END = T(44.0)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, END


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, hexcol, rough=0.5, metal=0.0, emit=0.0, noise=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    col = srgb(hexcol)
    bsdf.inputs["Base Color"].default_value = (*col, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*col, 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    if noise:  # variação procedural (concreto, papelão)
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = noise[0]
        tex.inputs["Detail"].default_value = 8
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*[c * noise[1] for c in col], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, c * noise[2]) for c in col], 1)
        nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    m.diffuse_color = (*col, 1)
    return m


# ================================================================ TRABALHADOR
M = {
    "camisa": mat("Camisa", "#2453a6", 0.65),
    "calca": mat("Calca", "#1f2633", 0.75),
    "pele": mat("Pele", "#c48e6a", 0.55),
    "botina": mat("Botina", "#2b1d14", 0.45),
    "luva": mat("Luva", "#d9822b", 0.75),
    "capacete": mat("Capacete", "#f5c400", 0.28),
    "olho": mat("Olhos", "#101010", 0.2),
    "colete": mat("Colete", "#ff6a13", 0.6),
    "refletivo": mat("Refletivo", "#e6e6e6", 0.15, metal=0.6, emit=0.15),
    "caixa": mat("Papelao", "#b37a43", 0.85, noise=(18, 0.85, 1.12)),
    "fita": mat("Fita", "#8c5a2a", 0.35),
}
MATS = list(M.values())

BONES = [
    ("root", (0, 0, 0), (0, 0.25, 0), None, False, False),
    ("hips", (0, 0, 0.95), (0, 0, 1.07), "root", False, True),
    ("spine", (0, 0, 1.07), (0, 0, 1.28), "hips", True, True),
    ("chest", (0, 0, 1.28), (0, 0, 1.48), "spine", True, True),
    ("neck", (0, 0, 1.48), (0, 0, 1.56), "chest", True, True),
    ("head", (0, 0, 1.56), (0, 0, 1.80), "neck", True, True),
    ("box", (0, -0.33, 0.18), (0, -0.33, 0.40), "root", False, True),
]
GRIP_X, GRIP_Z = 0.198, 0.14  # punho relativo ao centro da caixa
for s, x in (("L", 1), ("R", -1)):
    BONES += [
        (f"upperarm.{s}", (0.21 * x, 0, 1.45), (0.21 * x, 0.025, 1.16), "chest", False, True),
        (f"forearm.{s}", (0.21 * x, 0.025, 1.16), (0.21 * x, 0, 0.90), f"upperarm.{s}", True, True),
        (f"hand.{s}", (0.21 * x, 0, 0.90), (0.21 * x, 0, 0.80), f"forearm.{s}", True, True),
        (f"thigh.{s}", (0.10 * x, 0, 0.93), (0.10 * x, -0.025, 0.50), "hips", False, True),
        (f"shin.{s}", (0.10 * x, -0.025, 0.50), (0.10 * x, 0, 0.08), f"thigh.{s}", True, True),
        (f"foot.{s}", (0.10 * x, 0, 0.08), (0.10 * x, -0.16, 0.03), f"shin.{s}", True, True),
        (f"foot_ik.{s}", (0.10 * x, 0, 0.08), (0.10 * x, -0.16, 0.03), "root", False, False),
        (f"knee_pole.{s}", (0.10 * x, -0.6, 0.5), (0.10 * x, -0.7, 0.5), "root", False, False),
        (f"hand_ik.{s}", (GRIP_X * x, -0.33, 0.18 + GRIP_Z), (GRIP_X * x, -0.33, 0.08 + GRIP_Z), "box", False, False),
        (f"elbow_pole.{s}", (0.40 * x, 0.6, 1.15), (0.40 * x, 0.7, 1.15), "root", False, False),
    ]

arm_data = bpy.data.armatures.new("Rig")
arm = bpy.data.objects.new("Trabalhador_Rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
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
REST3 = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
REST_HEAD = {b.name: b.head_local.copy() for b in arm_data.bones}

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


def set_pose(bone, delta=(0, 0, 0), rot=(0, 0, 0)):
    p = pb[bone]
    R3 = REST3[bone]
    p.location = R3.inverted() @ Vector(delta)
    R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
    p.rotation_quaternion = (R3.inverted() @ R @ R3).to_quaternion()


def calibrate(owner, joint):
    c = pb[owner].constraints["IK"]
    rest = arm_data.bones[joint].tail_local.copy()
    best = None
    for deg in range(-180, 181, 5):
        c.pole_angle = math.radians(deg)
        bpy.context.view_layer.update()
        err = (pb[joint].tail - rest).length
        if best is None or err < best[0]:
            best = (err, deg)
    c.pole_angle = math.radians(best[1])


for s in ("L", "R"):
    calibrate(f"shin.{s}", f"thigh.{s}")
    # alvo da mão temporariamente na posição de descanso para calibrar
    set_pose(f"hand_ik.{s}", REST_HEAD[f"hand.{s}"] - REST_HEAD[f"hand_ik.{s}"])
    calibrate(f"forearm.{s}", f"upperarm.{s}")
    set_pose(f"hand_ik.{s}")

# ---------------------------------------------------------------- malha
mesh = bpy.data.meshes.new("Trabalhador")
body = bpy.data.objects.new("Trabalhador", mesh)
scene.collection.objects.link(body)
for m in MATS:
    mesh.materials.append(m)
for b in BONES:
    if b[5]:
        body.vertex_groups.new(name=b[0])
bm = bmesh.new()
dl = bm.verts.layers.deform.verify()


def _finish(verts, bone, m, smooth=True):
    gi, mi = body.vertex_groups[bone].index, MATS.index(M[m])
    for v in verts:
        v[dl][gi] = 1.0
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index, f.smooth = mi, smooth


def _place(verts, p1, p2, scale=(1, 1, 1)):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4() if d.length > 1e-6 else Matrix()
    Mx = Matrix.Translation((p1 + p2) / 2) @ Matrix.Diagonal((*scale, 1)) @ rot
    bmesh.ops.transform(bm, matrix=Mx, verts=verts)


def capsule(p1, p2, r, bone, m, scale=(1, 1, 1), seg=24):
    L = (Vector(p2) - Vector(p1)).length
    verts = list(bmesh.ops.create_cone(bm, cap_ends=False, segments=seg, radius1=r, radius2=r, depth=L)["verts"])
    for z in (-L / 2, L / 2):
        sp = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=12, radius=r)
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=sp["verts"])
        verts += sp["verts"]
    _place(verts, p1, p2, scale)
    _finish(verts, bone, m)


def sphere(c, r, bone, m, scale=(1, 1, 1)):
    sp = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=16, radius=r)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*scale, 1)), verts=sp["verts"])
    _finish(sp["verts"], bone, m)


def cyl(p1, p2, r1, r2, bone, m, seg=28, scale=(1, 1, 1)):
    L = (Vector(p2) - Vector(p1)).length
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=L)
    _place(res["verts"], p1, p2, scale)
    _finish(res["verts"], bone, m)


def cube(center, size, bone, m, smooth=False):
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)), verts=res["verts"])
    _finish(res["verts"], bone, m, smooth)


# tronco + colete refletivo
capsule((-0.10, 0, 0.93), (0.10, 0, 0.93), 0.11, "hips", "calca", scale=(1, 0.85, 1))
capsule((0, 0, 1.03), (0, 0, 1.24), 0.125, "spine", "camisa", scale=(1.05, 0.78, 1))
capsule((0, 0, 1.28), (0, 0, 1.40), 0.15, "chest", "camisa", scale=(1, 0.72, 1))
capsule((-0.19, 0, 1.44), (0.19, 0, 1.44), 0.065, "chest", "camisa")
cyl((0, 0, 1.00), (0, 0, 1.27), 0.138, 0.138, "spine", "colete", scale=(1.05, 0.8, 1))
cyl((0, 0, 1.27), (0, 0, 1.43), 0.158, 0.13, "chest", "colete", scale=(1, 0.75, 1))
cyl((0, 0, 1.10), (0, 0, 1.135), 0.141, 0.141, "spine", "refletivo", scale=(1.05, 0.8, 1))
cyl((0, 0, 1.19), (0, 0, 1.225), 0.141, 0.141, "spine", "refletivo", scale=(1.05, 0.8, 1))
for x in (0.075, -0.075):  # alças refletivas
    cube((x, -0.112, 1.33), (0.035, 0.012, 0.2), "chest", "refletivo")
    cube((x, 0.112, 1.33), (0.035, 0.012, 0.2), "chest", "refletivo")
cyl((0, 0, 1.47), (0, 0, 1.58), 0.05, 0.048, "neck", "pele")
sphere((0, -0.01, 1.665), 0.105, "head", "pele", scale=(1, 1.02, 1.15))
for x in (0.038, -0.038):
    sphere((x, -0.10, 1.68), 0.013, "head", "olho")
sphere((0, -0.112, 1.65), 0.016, "head", "pele")
hel = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=16, radius=0.125)
bmesh.ops.delete(bm, geom=[v for v in hel["verts"] if v.co.z < -0.001], context="VERTS")
hv = [v for v in hel["verts"] if v.is_valid]
bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0.0, 1.70)) @ Matrix.Diagonal((1, 1.08, 0.92, 1)), verts=hv)
_finish(hv, "head", "capacete")
cyl((0, -0.035, 1.695), (0, -0.035, 1.705), 0.15, 0.15, "head", "capacete", scale=(1, 1.12, 1))
cube((0, 0, 1.815), (0.03, 0.24, 0.02), "head", "capacete", smooth=True)  # nervura
for s, x in (("L", 1), ("R", -1)):
    capsule((0.21 * x, 0, 1.44), (0.21 * x, 0.025, 1.17), 0.052, f"upperarm.{s}", "camisa")
    capsule((0.21 * x, 0.025, 1.15), (0.21 * x, 0, 0.93), 0.044, f"forearm.{s}", "camisa")
    capsule((0.21 * x, 0, 0.895), (0.21 * x, -0.005, 0.82), 0.043, f"hand.{s}", "luva", scale=(0.75, 1, 1))
    cyl((0.21 * x, 0.004, 0.90), (0.21 * x, 0.004, 0.94), 0.05, 0.05, f"hand.{s}", "luva")  # punho da luva
    capsule((0.10 * x, 0, 0.90), (0.10 * x, -0.025, 0.51), 0.076, f"thigh.{s}", "calca")
    capsule((0.10 * x, -0.025, 0.49), (0.10 * x, 0, 0.13), 0.06, f"shin.{s}", "calca")
    cyl((0.10 * x, 0, 0.22), (0.10 * x, 0, 0.245), 0.063, 0.063, f"shin.{s}", "refletivo")
    capsule((0.10 * x, 0.035, 0.055), (0.10 * x, -0.15, 0.05), 0.052, f"foot.{s}", "botina", scale=(1, 1, 0.8))
    cyl((0.10 * x, 0.0, 0.08), (0.10 * x, 0.0, 0.15), 0.058, 0.06, f"foot.{s}", "botina")
# caixa (osso "box" — vai junto no FBX)
BOX = Vector((0.34, 0.32, 0.36))
bc = Vector((0, -0.33, 0.18))
res = bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.transform(bm, matrix=Matrix.Translation(bc) @ Matrix.Diagonal((*BOX, 1)), verts=res["verts"])
bmesh.ops.bevel(bm, geom=list({e for v in res["verts"] for e in v.link_edges}), offset=0.008, segments=2, affect="EDGES")
boxverts = [v for v in bm.verts if (v.co - bc).length < 0.4 and abs(v.co.x) <= BOX.x / 2 + 1e-4
            and abs(v.co.y - bc.y) <= BOX.y / 2 + 1e-4 and v.co.z <= BOX.z + 1e-4 and not v[dl]]
_finish(boxverts, "box", "caixa", smooth=False)
cube(bc + Vector((0, 0, BOX.z / 2)), (0.07, BOX.y + 0.004, 0.004), "box", "fita")
cube(bc + Vector((0, -BOX.y / 2, BOX.z / 2 - 0.06)), (0.07, 0.004, 0.12), "box", "fita")
cube(bc + Vector((BOX.x / 2, 0, 0.06)), (0.003, 0.12, 0.06), "box", "fita")  # etiqueta lateral

bm.to_mesh(mesh)
bm.free()
body.parent = arm
body.modifiers.new("Armature", "ARMATURE").object = arm

# ================================================================ ANIMAÇÃO
def key(bone, frame, delta=(0, 0, 0), rot=(0, 0, 0)):
    set_pose(bone, delta, rot)
    p = pb[bone]
    p.keyframe_insert("location", frame=frame)
    p.keyframe_insert("rotation_quaternion", frame=frame)


def key_pos(bone, frame, pos, rot=(0, 0, 0)):
    key(bone, frame, Vector(pos) - REST_HEAD[bone], rot)


def keys(bone, table):
    for t, kw in table:
        key(bone, T(t), **kw)


R0 = {}
WRONG = dict(delta=(0, 0.13, -0.14), rot=(57, 0, 0))
SQUAT = dict(delta=(0, 0.11, -0.50), rot=(38, 0, 0))
keys("hips", [
    (0, R0), (4.5, R0), (6.3, WRONG), (7.2, WRONG), (8.1, dict(rot=(30, 0, 0), delta=(0, 0.07, -0.03))),
    (9.0, dict(rot=(8, 0, 0))), (11.0, dict(rot=(8, 0, 0))), (12.0, R0),
    (13.0, R0), (16.5, R0), (18.3, dict(delta=(0, 0.07, -0.30), rot=(26, 0, 0))), (20.0, SQUAT),
    (22.5, SQUAT), (24.2, dict(delta=(0, 0.07, -0.26), rot=(28, 0, 0))), (26.0, R0), (36.5, R0), (44, R0),
])
for bone, a in (("spine", 26), ("chest", 24)):
    keys(bone, [(0, R0), (4.5, R0), (6.3, dict(rot=(a, 0, 0))), (7.2, dict(rot=(a, 0, 0))),
                (8.1, dict(rot=(a * 0.6, 0, 0))), (9.0, R0), (44, R0)])
for bone in ("neck", "head"):
    keys(bone, [(0, R0), (4.5, R0), (6.3, dict(rot=(-16, 0, 0))), (7.2, dict(rot=(-16, 0, 0))), (9.0, R0),
                (13.0, R0), (16.5, R0), (20.0, dict(rot=(-11, 0, 0))), (22.5, dict(rot=(-11, 0, 0))),
                (24.2, dict(rot=(-7, 0, 0))), (26.0, R0), (44, R0)])

# caixa (no referencial do personagem)
BOX_KEYS = [(0, (0, -0.43, 0.18)), (7.2, (0, -0.43, 0.18)), (8.1, (0, -0.41, 0.52)), (9.0, (0, -0.37, 0.91)),
            (11.0, (0, -0.37, 0.91)), (12.0, (0, -0.33, 0.18)), (13.0, (0, -0.33, 0.18)), (22.5, (0, -0.33, 0.18)),
            (24.2, (0, -0.32, 0.50)), (26.0, (0, -0.30, 0.86)), (31.5, (0, -0.30, 0.86)),
            (32.2, (0, -0.30, 0.86)), (33.6, (0, -0.36, 0.92)), (44, (0, -0.36, 0.92))]
for t, p in BOX_KEYS:
    key_pos("box", T(t), p)

# braços: FK solto -> IK na caixa -> solta
for s in ("L", "R"):
    for cname, owner in (("IK", f"forearm.{s}"), ("CopyRot", f"hand.{s}")):
        c = pb[owner].constraints[cname]
        for t, v in ((0, 0), (4.7, 0), (6.4, 1), (11.0, 1), (12.0, 0), (17.0, 0), (19.9, 1),
                     (33.8, 1), (35.0, 0), (44, 0)):
            c.influence = v
            c.keyframe_insert("influence", frame=T(t))

# pés
STANCE = {"L": ((0.24, -0.08, 0.08), 10), "R": ((-0.24, 0.04, 0.08), -10)}
REST_FOOT = {"L": ((0.10, 0, 0.08), 0), "R": ((-0.10, 0, 0.08), 0)}
for s in ("L", "R"):
    x = 1 if s == "L" else -1
    k = lambda t, pos, yaw: key_pos(f"foot_ik.{s}", T(t), pos, rot=(0, 0, yaw))
    rp, ry = REST_FOOT[s]
    sp, sy = STANCE[s]
    a, b = (14.0, 14.6) if s == "R" else (14.6, 15.2)
    k(0, rp, ry); k(12.0, rp, ry); k(13.0, rp, ry); k(a, rp, ry)
    mid = tuple((Vector(rp) + Vector(sp)) / 2 + Vector((0, 0, 0.06)))
    k((a + b) / 2, mid, sy / 2); k(b, sp, sy); k(28.0, sp, sy)
    keys(f"knee_pole.{s}", [(0, R0), (15.0, R0), (17.0, dict(delta=(0.30 * x, 0, 0))),
                            (24.5, dict(delta=(0.30 * x, 0, 0))), (26.5, R0), (44, R0)])
    key(f"elbow_pole.{s}", 0)
    key(f"hand_ik.{s}", 0)

# giro com os pés (28.0–31.0 s) + um passo à frente (31.0–32.2 s): tronco sempre alinhado
def rz(a, v):
    c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
    return Vector((v[0] * c - v[1] * s_, v[0] * s_ + v[1] * c, v[2]))

def smooth(u): return u * u * (3 - 2 * u)

L0, R0w = Vector(STANCE["L"][0]), Vector(STANCE["R"][0])
FWD = Vector((-0.35, 0.30, 0))  # avanço em direção à bancada
Rmid = rz(-45, R0w)
Lfin, Rfin = rz(-90, L0), rz(-90, R0w)
# (início, fim, ângulo0, ângulo1, avanço0, avanço1, pé, de, para, yaw0, yaw1)
Z = Vector((0, 0, 0))
STEPS = [(28.0, 29.1, 0, -45, Z, Z, "R", R0w, Rmid, -10, -55),
         (29.1, 30.2, -45, -90, Z, Z, "L", L0, Lfin, 10, -80),
         (30.2, 31.0, -90, -90, Z, Z, "R", Rmid, Rfin, -55, -100),
         (31.0, 31.6, -90, -90, Z, FWD * 0.5, "L", Lfin, Lfin + FWD, -80, -80),
         (31.6, 32.2, -90, -90, FWD * 0.5, FWD, "R", Rfin, Rfin + FWD, -100, -100)]
foot_world = {"L": (L0, 10), "R": (R0w, -10)}
for t0, t1, a0, a1, tr0, tr1, mv, p0, p1, y0, y1 in STEPS:
    f0, f1 = T(t0), T(t1)
    for f in range(f0, f1 + 1):
        u = smooth((f - f0) / (f1 - f0))
        ang = a0 + (a1 - a0) * u
        tr = tr0.lerp(tr1, u)
        key("root", f, delta=tr, rot=(0, 0, ang))
        for s in ("L", "R"):
            if s == mv:
                pw = p0.lerp(p1, u) + Vector((0, 0, 0.06 * math.sin(math.pi * u)))
                yaw = y0 + (y1 - y0) * u
            else:
                pw, yaw = foot_world[s]
            key_pos(f"foot_ik.{s}", f, rz(-ang, pw - tr), rot=(0, 0, yaw - ang))
    foot_world[mv] = (p1, y1)
key("root", 0); key("root", T(27.9)); key("root", T(44), delta=FWD, rot=(0, 0, -90))
for s in ("L", "R"):
    pw, yaw = foot_world[s]
    key_pos(f"foot_ik.{s}", T(44), rz(90, pw - FWD), rot=(0, 0, yaw + 90))


def all_fcurves(obj):
    act = obj.animation_data.action
    if hasattr(act, "fcurves") and len(act.fcurves):
        return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                out += list(cb.fcurves)
    return out


for fc in all_fcurves(arm):
    for kp in fc.keyframe_points:
        kp.interpolation = "BEZIER"
        kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    fc.update()
arm.animation_data.action.name = "Treinamento_Levantamento"

# ================================================================ GALPÃO
env = bpy.data.collections.new("Galpao")
scene.collection.children.link(env)
E = {
    "piso": mat("Concreto", "#62666d", 0.55, noise=(6, 0.8, 1.12)),
    "parede": mat("Parede", "#8f959d", 0.8, noise=(3, 0.9, 1.05)),
    "faixa": mat("FaixaAmarela", "#f2c200", 0.55),
    "montante": mat("Montante", "#1f4fa3", 0.4, metal=0.3),
    "longarina": mat("Longarina", "#ff6a13", 0.4, metal=0.3),
    "pallet": mat("Pallet", "#b48a5a", 0.85, noise=(30, 0.8, 1.1)),
    "caixa2": mat("Caixas", "#a8733f", 0.85, noise=(14, 0.85, 1.12)),
    "caixa3": mat("Caixas2", "#c49562", 0.85, noise=(14, 0.85, 1.12)),
    "metal": mat("Metal", "#5b6370", 0.35, metal=0.8),
    "tampo": mat("Tampo", "#3b4250", 0.45, metal=0.4),
    "filme": mat("FilmeStretch", "#dfe6ee", 0.15, metal=0.0),
    "luz": mat("Luminaria", "#fff6e0", 0.3, emit=12),
    "cinza": mat("Cinza", "#3a3f47", 0.7),
}


def ebox(name, center, size, m, col=env):
    me = bpy.data.meshes.new(name)
    b = bmesh.new()
    bmesh.ops.create_cube(b, size=1.0)
    bmesh.ops.transform(b, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)), verts=b.verts)
    b.to_mesh(me)
    b.free()
    o = bpy.data.objects.new(name, me)
    me.materials.append(E[m] if isinstance(m, str) else m)
    col.objects.link(o)
    return o


def join(objs, name):
    """junta vários objetos num só (mais leve)"""
    me = bpy.data.meshes.new(name)
    b = bmesh.new()
    mats = []
    for o in objs:
        for m in o.data.materials:
            if m not in mats:
                mats.append(m)
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        bmesh.ops.transform(tmp, matrix=o.matrix_world, verts=tmp.verts)
        idx = mats.index(o.data.materials[0])
        for f in tmp.faces:
            f.material_index = idx
        tmpme = bpy.data.meshes.new("tmp")
        tmp.to_mesh(tmpme)
        b.from_mesh(tmpme)
        tmp.free()
        bpy.data.meshes.remove(tmpme)
        bpy.data.meshes.remove(o.data)
    b.to_mesh(me)
    b.free()
    o = bpy.data.objects.new(name, me)
    for m in mats:
        me.materials.append(m)
    env.objects.link(o)
    return o


ebox("Piso", (0, 0, -0.01), (30, 30, 0.02), "piso")
ebox("ParedeFundo", (-7.5, 0, 4), (0.2, 30, 8), "parede")
ebox("ParedeLado", (0, 8.5, 4), (30, 0.2, 8), "parede")
ebox("Rodape", (-7.38, 0, 0.6), (0.05, 30, 1.2), "faixa")
# faixas de corredor
for y in (-1.25, 1.25):
    ebox(f"Faixa_{y}", (-1, y, 0.001), (16, 0.1, 0.004), "faixa")
# área de trabalho demarcada (zebrado)
for i in range(9):
    ebox(f"Zebra_{i}", (2.6 - i * 0.22, -1.25 - 0.18, 0.0015), (0.1, 0.25, 0.003), "faixa")


def pallet(x, y, rot=0, z=0):
    parts = []
    for dy in (-0.45, 0, 0.45):
        parts.append(ebox("p", (x, y + dy, z + 0.05), (1.2, 0.1, 0.1), "pallet"))
    for dx in (-0.55, -0.27, 0, 0.27, 0.55):
        parts.append(ebox("p", (x + dx, y, z + 0.125), (0.1, 1.0, 0.025), "pallet"))
    return parts


def stack(x, y, z, nx, ny, nz, s=(0.38, 0.32, 0.30), wrap=False):
    parts = []
    for i in range(nx):
        for j in range(ny):
            for k in range(nz):
                m = "caixa2" if (i + j + k) % 3 else "caixa3"
                parts.append(ebox("c", (x + (i - (nx - 1) / 2) * (s[0] + 0.01),
                                        y + (j - (ny - 1) / 2) * (s[1] + 0.01), z + s[2] / 2 + k * s[2]), s, m))
    if wrap:
        parts.append(ebox("f", (x, y, z + nz * s[2] / 2), (nx * (s[0] + 0.01) + 0.01, ny * (s[1] + 0.01) + 0.01,
                                                             nz * s[2] + 0.01), "filme"))
    return parts


rack = []
for ry in (-4.6, -1.9, 0.8, 3.5, 6.2):
    for dx in (-0.55, 0.55):
        rack.append(ebox("m", (-6.2 + dx, ry, 2.6), (0.09, 0.09, 5.2), "montante"))
for ry in (-3.25, -0.55, 2.15, 4.85):
    for lvl in (0.15, 1.75, 3.35):
        for dx in (-0.55, 0.55):
            rack.append(ebox("l", (-6.2 + dx, ry, lvl), (0.07, 2.6, 0.13), "longarina"))
        for py in (-0.65, 0.65):
            rack += pallet(-6.2, ry + py, z=lvl + 0.065)
            if (lvl + py + ry) % 2 > 0.6:
                rack += stack(-6.2, ry + py, lvl + 0.22, 3, 2, 3 if lvl < 3 else 2, wrap=False)
join(rack, "PortaPallets")

floor_stuff = []
for (x, y, n) in ((-2.6, -3.2, 3), (-3.9, -3.2, 2), (-3.0, 3.0, 4), (1.8, 3.4, 2), (-4.6, 1.6, 3)):
    floor_stuff += pallet(x, y)
    floor_stuff += stack(x, y, 0.15, 3, 3, n, wrap=False)
join(floor_stuff, "PalletsPiso")

# luminárias industriais
for lx in (-5, -1.5, 2):
    for ly in (-3, 1, 5):
        ebox("Lum", (lx, ly, 7.0), (0.6, 0.6, 0.06), "luz")

# bancada (onde a caixa será depositada)
BX, BY = -0.84, 0.58
bench = [ebox("b", (BX, BY, 0.72), (0.62, 0.9, 0.04), "tampo")]
for bx in (BX + 0.27, BX - 0.27):
    for by in (BY - 0.41, BY + 0.41):
        bench.append(ebox("b", (bx, by, 0.35), (0.05, 0.05, 0.70), "metal"))
bench.append(ebox("b", (BX, BY, 0.15), (0.58, 0.86, 0.025), "metal"))
join(bench, "Bancada")

# ================================================================ LUZ E CÂMERA
world = bpy.data.worlds.new("Mundo")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#9aa4b2"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.25
lights = bpy.data.collections.new("Luzes")
scene.collection.children.link(lights)


def light(name, kind, loc, rot, energy, col="#ffffff", size=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, srgb(col)
    if kind == "AREA":
        ld.size = size
    elif kind == "SUN":
        ld.angle = math.radians(size)
    o = bpy.data.objects.new(name, ld)
    o.location, o.rotation_euler = loc, [math.radians(a) for a in rot]
    lights.objects.link(o)


light("Teto", "AREA", (-1.5, 0, 6.5), (0, 0, 0), 1900, "#fff4e2", size=8)
light("Key", "AREA", (3.2, -2.6, 3.4), (50, 0, 52), 500, "#fff1dd", size=2.2)
light("Rim", "AREA", (-2.2, 2.4, 2.8), (-50, 0, 222), 380, "#cfe6ff", size=1.4)
light("Fill", "AREA", (2.5, 2.5, 1.6), (-70, 0, 140), 120, "#dfe8ff", size=3)

cam_d = bpy.data.cameras.new("Camera")
cam_d.lens = 40
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("Camera", cam_d)
lights.objects.link(cam)
scene.camera = cam
focus = bpy.data.objects.new("Foco", None)
lights.objects.link(focus)
cam_d.dof.focus_object = focus
trk = cam.constraints.new("TRACK_TO")
trk.target, trk.track_axis, trk.up_axis = focus, "TRACK_NEGATIVE_Z", "UP_Y"

CAM = [  # tempo, posição da câmera, ponto de foco
    (0.0, (7.2, -5.0, 2.6), (-0.6, 0.0, 1.0)),
    (3.4, (4.5, -1.5, 1.15), (0, -0.15, 0.78)),
    (6.3, (4.0, -1.35, 1.0), (0, -0.20, 0.70)),
    (11.0, (4.2, -1.45, 1.05), (0, -0.18, 0.78)),
    (13.0, (4.7, -1.6, 1.22), (0, -0.15, 0.88)),
    (16.6, (4.6, -1.55, 1.2), (0, -0.15, 0.86)),
    (20.0, (3.8, -1.25, 0.95), (0, -0.18, 0.62)),
    (22.5, (3.8, -1.25, 0.97), (0, -0.18, 0.64)),
    (26.0, (4.7, -1.65, 1.25), (0, -0.15, 0.92)),
    (28.0, (4.7, -1.7, 1.3), (-0.1, -0.1, 0.92)),
    (31.0, (3.2, -3.4, 1.35), (-0.35, 0.15, 0.88)),
    (33.6, (-0.5, -4.0, 1.2), (-0.55, 0.35, 0.86)),
    (36.5, (-0.55, -4.15, 1.22), (-0.55, 0.35, 0.86)),
]
for t, cp, fp in CAM:
    cam.location, focus.location = cp, fp
    cam.keyframe_insert("location", frame=T(t))
    focus.keyframe_insert("location", frame=T(t))
# corte seco entre o ERRADO e o CERTO (cartela cobre 11–13 s)
for o in (cam, focus):
    for fc in all_fcurves(o):
        for kp in fc.keyframe_points:
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            if abs(kp.co.x - T(11.0)) < 0.5:
                kp.interpolation = "CONSTANT"

# ================================================================ RENDER
r = scene.render
r.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 3
scene.cycles.adaptive_threshold = 0.04
r.use_persistent_data = True
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 2
scene.cycles.transparent_max_bounces = 4
r.resolution_x, r.resolution_y, r.resolution_percentage = 1280, 720, RES
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
r.film_transparent = False

# ================================================================ DADOS PARA OS INDICADORES 2D
from bpy_extras.object_utils import world_to_camera_view


def frames_3d():
    out = []
    for a, b in SEG_3D:
        out += list(range(T(a), T(b) + 1))
    return out


def anchors():
    data = {}
    W, H = 1920, 1080
    for f in frames_3d():
        scene.frame_set(f)
        mw = arm.matrix_world
        def p2(v):
            c = world_to_camera_view(scene, cam, mw @ v)
            return [round(c.x * W, 1), round((1 - c.y) * H, 1), round(c.z, 3)]
        def behind(bone, dist, at="head"):
            p = pb[bone]
            off = p.matrix.to_3x3() @ (REST3[bone].inverted() @ Vector((0, dist, 0)))
            return (p.head if at == "head" else p.tail) + off
        back = [behind("hips", 0.12), behind("spine", 0.125), behind("chest", 0.12),
                behind("chest", 0.11, "tail"), behind("neck", 0.07, "tail")]
        data[f] = {
            "back": [p2(v) for v in back],
            "lumbar": p2(behind("spine", 0.13)),
            "kneeL": p2(pb["thigh.L"].tail), "kneeR": p2(pb["thigh.R"].tail),
            "box": p2(pb["box"].head), "hips": p2(pb["hips"].head),
            "head": p2(pb["head"].tail), "footL": p2(pb["foot.L"].head), "footR": p2(pb["foot.R"].head),
            "handL": p2(pb["hand.L"].head),
        }
    return data


scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "treinamento_levantamento.blend"))

if "--anchors" in argv:
    with open(os.path.join(OUT, "anchors.json"), "w") as fh:
        json.dump({"fps": FPS, "seg3d": SEG_3D, "end": END, "frames": anchors()}, fh)

if "--fbx" in argv:
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True); body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, "trabalhador_treinamento.fbx"), use_selection=True,
                             object_types={"ARMATURE", "MESH"}, apply_scale_options="FBX_SCALE_ALL",
                             add_leaf_bones=False, use_armature_deform_only=True, bake_anim=True,
                             bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                             bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0)
    bpy.ops.object.select_all(action="DESELECT")
    for o in env.objects:
        o.select_set(True)
    bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, "galpao.fbx"), use_selection=True,
                             object_types={"MESH"}, apply_scale_options="FBX_SCALE_ALL", bake_anim=False)

for f in PREVIEW:
    scene.frame_set(f)
    r.filepath = os.path.join(OUT, f"prev_{f:04d}.png")
    bpy.ops.render.render(write_still=True)

if RENDER:
    os.makedirs(os.path.join(OUT, "frames"), exist_ok=True)
    first = int(arg("--from", "0"))
    for f in frames_3d():
        path = os.path.join(OUT, "frames", f"f_{f:04d}.png")
        if f < first or os.path.exists(path):
            continue
        scene.frame_set(f)
        r.filepath = path
        bpy.ops.render.render(write_still=True)
print("OK", OUT)
