"""Regenera la política de alarma a partir de los diseños y estilos de imagen existentes."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
STYLES = Path(__file__).resolve().parent
KIT = ROOT / 'src/templates/_tools/explainer-kit'
ALARM = {'red': '#B74A42', 'yellow': '#D3B35A', 'allowed': ['ribbon', 'marked_word', 'underline', 'arrow'],
         'levels': {'negro': {'max_area': .20, 'opacity': .9}, 'alto': {'max_area': .10, 'opacity': .8},
                    'medio': {'max_area': .05, 'opacity': .7}, 'basico': {'max_area': .02, 'opacity': .6}}}

for category in ('node_tech', 'node_history'):
    path = STYLES / (category + '.json')
    style = json.loads(path.read_text())
    design = json.loads((KIT / 'designs' / style['design_id'] / 'design.json').read_text())
    palette = design['defaults']['palette']
    for key in style['palette']:
        if key in palette:
            style['palette'][key] = palette[key]
    style['alarm'] = ALARM
    path.write_text(json.dumps(style, ensure_ascii=False, indent=2) + '\n')

# Atlas y dinero no traían piel de imagen. Las fuentes locales coinciden con
# familias de cada diseño; los handles del diseño son provisionales.
import hashlib
import shutil
for category, design_id, family, filename, handle in (
    ('node_politics', 'atlas', 'Archivo', 'Archivo-900.ttf', '@nodepolitics'),
    ('node_economy', 'dinero', 'Open Sans', 'Open-Sans-700.ttf', '@nodeconomy'),
):
    design = json.loads((KIT / 'designs' / design_id / 'design.json').read_text())
    base = json.loads((STYLES / 'node_tech.json').read_text())
    src = KIT / 'vendor/fonts' / filename
    dest = STYLES / 'fonts' / filename
    shutil.copyfile(src, dest)
    license_name = 'Archivo-OFL.txt' if design_id == 'atlas' else 'Open-Sans-OFL.txt'
    shutil.copyfile(KIT / 'vendor/fonts' / license_name, STYLES / 'fonts/licenses' / license_name)
    asset = {'family': family, 'weight': 900 if design_id == 'atlas' else 700, 'style': 'normal',
             'path': 'fonts/' + filename, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
             'license': 'OFL-1.1', 'license_url': 'https://openfontlicense.org/'}
    d = design['defaults']['palette']
    palette = {'bg': d['bg'], 'bg2': d.get('bg2', d['bg']), 'ink': d['ink'],
               'muted': d['ink'], 'accent': d['accent'], 'accentInk': d['accentInk']}
    base.update(style_id=category + '_' + design_id, category_id=category, design_id=design_id,
                palette=palette, fonts={'headline': family, 'body': family, 'mono': family,
                                         'decorative': family, 'font_assets': [asset]},
                brand={'name': 'NodePolitics' if design_id == 'atlas' else 'NodeEconomy', 'handle': handle})
    base['composition']['allowed_components'] = [f'image.{design_id}.daily_fact', f'image.{design_id}.five_slides']
    (STYLES / (category + '.json')).write_text(json.dumps(base, ensure_ascii=False, indent=2) + '\n')

# NodeMotion no tiene diseño explainer; la adaptación motion declara la procedencia Caution.
design = json.loads((KIT / 'designs/motion/design.json').read_text())
base = json.loads((STYLES / 'node_tech.json').read_text())
src = KIT / 'vendor/fonts/Anton-Regular.ttf'
dest = STYLES / 'fonts/Anton-Regular.ttf'
shutil.copyfile(src, dest)
shutil.copyfile(KIT / 'vendor/fonts/Anton-OFL.txt', STYLES / 'fonts/licenses/Anton-OFL.txt')
asset = {'family': 'Anton', 'weight': 400, 'style': 'normal', 'path': 'fonts/Anton-Regular.ttf',
         'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'license': 'OFL-1.1', 'license_url': 'https://openfontlicense.org/'}
base.update(style_id='node_motion_motion', category_id='node_motion', design_id='motion',
            palette=design['defaults']['palette'],
            fonts={'headline': 'Anton', 'body': 'Inter', 'mono': 'JetBrains Mono', 'decorative': 'Anton',
                   'font_assets': [asset] + base['fonts']['font_assets'][:3]},
            brand={'name': 'NodeMotion', 'handle': design['channel']['handle']})
base['composition']['allowed_components'] = ['image.motion.daily_fact', 'image.motion.five_slides']
(STYLES / 'node_motion.json').write_text(json.dumps(base, ensure_ascii=False, indent=2) + '\n')
