import bpy
bpy.ops.wm.open_mainfile(filepath="/home/claude/pro/dados/treinamento_levantamento.blend")
sc = bpy.context.scene
def sel(names):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        o.select_set(o.name in names)
# galpão estático
env = [o.name for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('Trabalhador',)]
sel(env)
bpy.ops.export_scene.gltf(filepath="assets/galpao.glb", export_format='GLB', use_selection=True,
    export_animations=False, export_apply=True, export_lights=False, export_cameras=False)
# trabalhador com a animação do jeito certo
sc.frame_start, sc.frame_end = 312, 876
sel(['Trabalhador', 'Trabalhador_Rig'])
bpy.ops.export_scene.gltf(filepath="assets/trabalhador.glb", export_format='GLB', use_selection=True,
    export_animations=True, export_frame_range=True, export_force_sampling=True, export_def_bones=True,
    export_animation_mode='ACTIVE_ACTIONS', export_optimize_animation_size=True,
    export_lights=False, export_cameras=False)
print("EXPORT OK")
