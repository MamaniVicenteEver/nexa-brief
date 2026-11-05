"""Ejecutar con Blender --background --threads 1 --python render.py -- [opciones]."""

import argparse
import json
import math
import os
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalog import SPECS
from models import build


def setup(samples,resolution):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=samples
    scene.cycles.use_denoising=True
    scene.cycles.seed=581
    scene.cycles.use_animated_seed=False
    scene.cycles.max_bounces=3
    scene.render.threads_mode="FIXED"
    scene.render.threads=1
    scene.render.resolution_x=resolution
    scene.render.resolution_y=resolution
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="8"
    scene.render.image_settings.compression=80
    scene.render.use_file_extension=True
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    world=bpy.data.worlds.new("Relleno neutro")
    world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.65,.65,.65,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=.45
    scene.world=world
    sun=bpy.data.lights.new("Sol arriba izquierda","SUN")
    sun.energy=3.0
    sun.angle=math.radians(9)
    o=bpy.data.objects.new("Sol arriba izquierda",sun)
    scene.collection.objects.link(o)
    direction=Vector((75,-100,-145))
    o.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
    cam=bpy.data.cameras.new("Cenital ortográfica")
    cam.type="ORTHO"; cam.ortho_scale=112
    o=bpy.data.objects.new("Cenital ortográfica",cam)
    scene.collection.objects.link(o)
    o.location=(0,0,180); o.rotation_euler=(0,0,0)
    scene.camera=o
    return scene


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=Path("/tmp/atlas-sprites-raw"))
    parser.add_argument("--only",nargs="+",choices=list(SPECS))
    parser.add_argument("--samples",type=int,default=16)
    parser.add_argument("--resolution",type=int,default=1280)
    parser.add_argument("--save-blend",action="store_true",help="Guarda escenas solo en el directorio de trabajo")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    if not args.only or len(args.only)!=1: parser.error("Un solo sprite por proceso Blender; usar batch.py")
    for sprite_id in args.only or SPECS:
        started=time.perf_counter()
        scene=setup(args.samples,args.resolution)
        build(sprite_id,SPECS[sprite_id])
        aircraft_count=sum(o.name.startswith("Avión en cubierta") for o in scene.objects)
        if "aircraft" in SPECS[sprite_id]:
            assert aircraft_count==SPECS[sprite_id]["aircraft"], "Cantidad de aviones en cubierta"
        model_time=time.perf_counter()-started
        scene.render.filepath=str((args.output/f"{sprite_id}.png").resolve())
        if args.save_blend: bpy.ops.wm.save_as_mainfile(filepath=str((args.output/f"{sprite_id}.blend").resolve()))
        render_start=time.perf_counter()
        bpy.ops.render.render(write_still=True)
        record=dict(id=sprite_id,blender=bpy.app.version_string,engine="Cycles CPU",threads=1,samples=args.samples,
                    source_size=[args.resolution,args.resolution],ortho_scale=scene.camera.data.ortho_scale,model_seconds=round(model_time,3),
                    render_seconds=round(time.perf_counter()-render_start,3),sun_from=[-75,100,145],
                    deck_aircraft_actual=aircraft_count,spec=SPECS[sprite_id])
        (args.output/f"{sprite_id}.json").write_text(json.dumps(record,indent=2)+"\n")
        print("SPRITE_DONE "+json.dumps(record),flush=True)


if __name__=="__main__": main()
