"""Contrato de episodios de datos que consumen el motor Atlas compartido."""

from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlsplit


ATLAS_ENGINE_URL = '/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js'
PROTO_URL = '/api/v1/explainer/files/sandbox/_proto/proto.js'
_CODE_SUFFIXES = {'.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.wasm'}


class _EntryScripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sources = []
        self.problems = []
        self.script = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('iframe', 'object', 'embed'):
            self.problems.append('documento ejecutable incrustado en la entrada del episodio')
        if any(key.lower().startswith('on') for key in attrs):
            self.problems.append('manejadores JavaScript inline')
        if any(str(value).strip().lower().startswith('javascript:') for value in attrs.values()):
            self.problems.append('URLs JavaScript inline')
        if tag == 'script':
            self.script = {'type': attrs.get('type', ''), 'src': attrs.get('src'), 'text': ''}
            if self.script['src']:
                self.sources.append(self.script['src'])

    def handle_data(self, data):
        if self.script is not None:
            self.script['text'] += data

    def handle_endtag(self, tag):
        if tag != 'script' or self.script is None:
            return
        script, self.script = self.script, None
        if script['text'].strip():
            if script['type'] in ('application/json', 'application/ld+json') and not script['src']:
                try:
                    json.loads(script['text'])
                except ValueError:
                    self.problems.append('datos JSON inválidos en index.html')
            else:
                self.problems.append('código de ejecución inline')


def validate_atlas_episode_runtime(root):
    """Rechazar motores locales antes de producir o aceptar un episodio nuevo."""
    root = Path(root)
    problems = []
    for name in ('engine', 'components', 'renderers', 'motor'):
        if (root / name).exists() or (root / name).is_symlink():
            problems.append(f'carpeta de código propia: {name}/')
    for relative in ('tools/build_scene.py', 'build_scene.py'):
        if (root / relative).exists():
            problems.append(f'generador copiado: {relative}')
    assets = root / 'assets'
    if assets.is_dir():
        for path in assets.rglob('*'):
            if path.is_file() and path.suffix.lower() in _CODE_SUFFIXES:
                problems.append(f'código de ejecución en medios: {path.relative_to(root)}')
    problems.extend(_entry_problems(root))
    _reject(problems)


def _entry_problems(root):
    problems = []
    index = root / 'index.html'
    if index.is_symlink():
        problems.append('index.html no puede ser un enlace a otro ejecutor')
    elif not index.is_file():
        problems.append('falta index.html con el motor central')
    else:
        parser = _EntryScripts()
        parser.feed(index.read_text(encoding='utf-8'))
        problems.extend(parser.problems)
        paths = []
        for source in parser.sources:
            url = urlsplit(source)
            if url.scheme or url.netloc or url.path not in (ATLAS_ENGINE_URL, PROTO_URL):
                problems.append(f'script ajeno al motor central: {source}')
            else:
                paths.append(url.path)
        if paths.count(ATLAS_ENGINE_URL) != 1 or paths.count(PROTO_URL) != 1:
            problems.append('la entrada debe cargar Proto y una sola instancia del motor Atlas central')
    return problems


def validate_atlas_episode_entry(root):
    """Comprobar la ejecución central también al grabar episodios históricos."""
    _reject(_entry_problems(Path(root)))


def _reject(problems):
    if problems:
        raise ValueError(
            'Atlas en Movimiento exige un episodio de datos y un motor compartido: '
            + '; '.join(problems)
            + '. Los componentes nuevos se implementan en el motor principal y se registran en Showcase; '
            'el episodio solo declara tipos, parámetros, tiempos y medios.'
        )
