"""Prepara chunks compatibles con tts.gemini_annotated. Nunca importa tts ni genera voz.

Uso: python -I preparar-kit.py SCRIPT.json --perfil B --kit /ruta/explainer-kit
Salidas siempre junto a este archivo. El kit original no se modifica.
"""
import argparse, ast, json, re
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('script',type=Path); p.add_argument('--perfil',choices=['A','B'],default='B')
p.add_argument('--kit',type=Path,required=True)
a=p.parse_args(); root=Path(__file__).resolve().parent
script=json.loads(a.script.read_text()); profile=json.loads((root/'perfiles-tts.json').read_text())[a.perfil]
tree=ast.parse((a.kit/'tools/narrate.py').read_text())
# Solo constantes de dirección y función pura mark(); sin main(), imports ni clientes.
env={'re':re}
for node in tree.body:
    if isinstance(node,ast.Assign):
        for target in node.targets:
            if isinstance(target,ast.Name) and target.id in {'STYLE','BEFORE_LONG','BEFORE_BREATH'}:
                env[target.id]=ast.literal_eval(node.value)
    elif isinstance(node,ast.FunctionDef) and node.name=='mark':
        exec(compile(ast.Module(body=[node],type_ignores=[]),'kit-mark-only','exec'),env)
chunks=[]; prev=None
for s in script['segments']:
    text=env['mark'](s,prev)
    # Elimina duplicaciones contiguas de marcas; no toca palabras.
    text=re.sub(r'(<(?:short pause|long pause|breath)>)\s*\1',r'\1',text)
    style=profile['voice_direction']+' '+env['STYLE'].get(s.get('tone'),'Natural, documental.')
    if s.get('delivery_note'):style+=' '+s['delivery_note']
    chunks.append({'id':s['id'],'text':text,'style':style,'intensity':s.get('intensity',.4)})
    prev=s
out={'profile':a.perfil,'voice':profile['voice_first'],'model':'gemini-3.8-flash-tts','api_calls':0,'source_script':str(a.script),'warning':'Preparación local. No usar narrate.chunks() de nuevo: agrega 130 ppm. Pasar text/style a tts.gemini_annotated solo cuando otra tarea autorice generar. Las pausas largas específicas se añaden al guion; mark() solo sigue los tonos.','chunks':chunks}
(root/f'kit-chunks-{a.perfil}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(f'{len(chunks)} bloques preparados; cero peticiones; salida: kit-chunks-{a.perfil}.json')
