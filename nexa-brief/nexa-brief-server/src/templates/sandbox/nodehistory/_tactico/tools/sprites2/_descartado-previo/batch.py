"""One Blender process at a time; each process exits after one sprite. No service changes."""
import argparse,json,os,subprocess,time
from pathlib import Path
from catalog import SPECS
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--phase',choices=['preview','final'],required=True)
p.add_argument('--only',nargs='+',choices=list(SPECS))
p.add_argument('--raw',type=Path)
p.add_argument('--blender',type=Path,default=Path.home()/'.local/opt/blender-5.2.3-linux-x64/blender')
p.add_argument('--force',action='store_true')
a=p.parse_args()
raw=(a.raw or Path('/tmp/atlas-sprites2')/f'raw-{a.phase}').resolve(); raw.mkdir(parents=True,exist_ok=True)
env=os.environ.copy()
for key,folder in [('CONFIG','config'),('SCRIPTS','scripts'),('RESOURCES','resources'),('EXTENSIONS','extensions'),('DATAFILES','data')]:
    dest=Path('/tmp/atlas-sprites2/blender')/folder; dest.mkdir(parents=True,exist_ok=True)
    env['BLENDER_USER_'+key]=str(dest)
env.update(OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1')
for name in a.only or SPECS:
    if not a.force and (raw/f'{name}.json').exists() and (raw/f'{name}.png').exists():
        print('SKIP '+name,flush=True); continue
    command=['nice','-n','19',str(a.blender),'--background','--threads','1','--python',str(HERE/'render.py'),'--',
             '--output',str(raw),'--only',name,'--samples','4' if a.phase=='preview' else '16',
             '--resolution','320' if a.phase=='preview' else '1280']
    started=time.monotonic()
    with (raw/f'{name}.log').open('w') as log:
        subprocess.run(command,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    print(json.dumps(dict(phase=a.phase,id=name,wall_seconds=round(time.monotonic()-started,2))),flush=True)
