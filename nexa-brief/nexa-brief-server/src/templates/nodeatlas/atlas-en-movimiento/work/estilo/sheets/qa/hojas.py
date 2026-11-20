from PIL import Image, ImageDraw
from pathlib import Path
p=Path('work/estilo/sheets/qa')
for style in ['clasico','v4-atlas','v2-mando','v3-cine']:
 canvas=Image.new('RGB',(1220,650),'#f1f1f1');draw=ImageDraw.Draw(canvas)
 for n,fmt in enumerate(['movil','escritorio']):
  path=p/f'escena-{style}-{fmt}.png';im=Image.open(path).convert('RGB');canvas.paste(im,(10+n*610,35));draw.text((12+n*610,10),f'{style} · {fmt}',fill='#111')
 canvas.save(p/f'hoja-{style}.png')
