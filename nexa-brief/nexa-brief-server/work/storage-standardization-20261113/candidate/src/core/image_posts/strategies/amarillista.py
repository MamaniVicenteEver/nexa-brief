"""Carrusel editorial basado en hechos aprobados y medios pertinentes."""
from __future__ import annotations
import json, logging, re, unicodedata
from pathlib import Path
from .base import Copy, Fact, Strategy, StrategyContext, extract_stat, slide, source_label, text, numbers_in
from .prueba_a_la_vista import _media_ref

ID = "amarillista"
CONFIG = json.loads((Path(__file__).resolve().parents[3] / "skills/image_posts/strategies/image_amarillista_v1.json").read_text(encoding="utf-8"))
LEVELS = CONFIG["titulo"]["niveles"]
log = logging.getLogger(__name__)


def rule_titles(fact: Fact) -> dict[str, str]:
    """Plantillas conservadoras solo para hechos reconocibles; lo demás pide edición."""
    from .amarillista_copy import validate_titles
    raw = fact.text.casefold()
    if re.search(r'(?<!\d)53\s*%', raw) and ('estadounidenses adultos' in raw or 'celular' in raw or 'smartphone' in raw):
        titles = dict(basico='La mitad cree que usa demasiado el celular',
            medio='¿También pasas demasiado tiempo con el celular?',
            alto='Admiten pasar demasiado tiempo con el celular',
            negro='La MITAD admite usar demasiado el celular')
    elif 'melaza' in raw and re.search(r'mató a 21 personas\b', raw):
        titles = dict(basico='La melaza mató a 21 personas en Boston',
            medio='¿Conocías la inundación de melaza de Boston?',
            alto='Boston perdió 21 vidas bajo la melaza',
            negro='Una ola de MELAZA mató en Boston')
    elif 'ia' in raw and re.search(r'(?<!\d)88\s*%', raw):
        titles = dict(basico='Una encuesta revela uso extendido de IA',
            medio='¿Tu organización también está usando IA?',
            alto='Casi todos reportan IA en sus organizaciones',
            negro='La IA ya domina esta ENCUESTA empresarial')
    elif 'amazon' in raw and re.search(r'recortó ~?250 puestos en devices & services', raw):
        amount = '~250' if '~250' in raw else '250'
        titles = dict(basico=f'Amazon recortó {amount} puestos en Devices & Services',
            medio='¿Conocías estos recortes de puestos en Amazon?',
            alto=f'Recortes en Amazon: {amount} puestos menos',
            negro=f'Amazon: {amount} puestos MENOS en Devices & Services')
    else:
        raise ValueError(f'{fact.claim_id}: requiere cuatro titulares editoriales revisados')
    return validate_titles(titles)


def title_for(fact: Fact, level: str, proposed: str = '') -> str:
    if level not in LEVELS:
        raise ValueError(f'Nivel desconocido: {level}')
    candidate = proposed or rule_titles(fact)[level]
    if not candidate.strip() or len(candidate) > 60 or len(candidate.split()) > 8:
        raise ValueError('El titular supera 8 palabras o 60 caracteres')
    return unicodedata.normalize('NFC', candidate)


def is_twist(fact: Fact) -> bool:
    return bool(re.search(r"\b(pero|aunque|sin embargo|no obstante|en cambio|pese a|a pesar de|solo|sólo|no habían|no habian|ya tenía|ya tenia|ya presentaba)\b", fact.text, re.I))


def question_for(ctx: StrategyContext) -> str:
    topic = (ctx.topic + ' ' + ctx.hook).casefold()
    if any(x in topic for x in ('celular', 'teléfono', 'smartphone')): return '¿Cuánto tiempo miras tu celular al día?'
    if any(x in topic for x in ('inteligencia artificial', ' ia ', 'ia en', ' ai ')): return '¿Cómo usas la IA en tu trabajo?'
    if 'melaza' in topic: return '¿Conocías la inundación de melaza de Boston?'
    if 'amazon' in topic: return '¿Cómo cambia la IA tu trabajo?'
    subject = ' '.join((ctx.topic or ctx.hook).strip(' ¿?!.').split()[:4])
    return f'¿Qué opinas sobre {subject}?' if subject else '¿Qué te interesa conocer ahora?'


def role_config(role):
    return next(r for r in CONFIG['roles'] if r['id'] == role)


def pick(facts: list[Fact]) -> list[Fact]:
    """Selección reproducible por roles aprobados, nunca por intuición del agente."""
    from . import amarillista_hilo as hilo
    if hilo.is_hilo(facts): return hilo.pick(facts)
    by_role = {}
    for fact in facts:
        if not fact.role:
            continue  # no adivinar que un dato sirve de reflexión o matiz
        if fact.role not in CONFIG['seleccion']['orden'] or fact.role == 'cierre':
            raise ValueError(f'Rol de hecho inválido: {fact.role}')
        if fact.role in by_role:
            raise ValueError(f'Rol duplicado: {fact.role}; seleccionar una evidencia')
        if not fact.url.startswith('https://') or not fact.source_name.strip():
            raise ValueError(f'{fact.claim_id}: dato sin fuente HTTPS identificada')
        if len(fact.text) > CONFIG['seleccion']['limite_hecho_caracteres']:
            raise ValueError(f'{fact.claim_id}: hecho demasiado largo')
        by_role[fact.role] = fact
    missing = set(CONFIG['seleccion']['roles_requeridos']) - set(by_role)
    if missing:
        raise ValueError('Falta evidencia con rol explícito: '+', '.join(sorted(missing)))
    return [by_role[role] for role in CONFIG['seleccion']['orden'] if role in by_role]


def build(facts: list[Fact], ctx: StrategyContext, copy: dict[str, Copy], media=None) -> list[dict]:
    from . import amarillista_hilo as hilo
    if hilo.is_hilo(facts): return hilo.build(facts, ctx, copy, media)
    if ctx.level not in LEVELS: raise ValueError(f"Nivel desconocido: {ctx.level}")
    if not ctx.brand or not ctx.handle: raise ValueError("El cierre requiere nombre y @ de la marca")
    facts = pick(facts)
    from .amarillista_copy import validate_titles, validate_reflections, diagram_for
    from .amarillista_visuals import diagram_element, validate_diagram
    cover_copy = copy.get(facts[0].claim_id)
    titles = validate_titles(cover_copy.headlines if cover_copy and cover_copy.headlines else rule_titles(facts[0]), [ctx.level])
    pages, used, used_ids, prominent = [], set(), set(), set()
    for index, fact in enumerate(facts):
        image = media.get(fact.claim_id) if isinstance(media, dict) else (media[index] if media and index < len(media) else None)
        identity = (getattr(image, 'provider', ''), getattr(image, 'provider_id', image.sha256)) if image else None
        if image and (image.sha256 in used or identity in used_ids): image = None
        if image: used.add(image.sha256); used_ids.add(identity)
        piece = copy.get(fact.claim_id)
        refs = [fact.claim_id]
        role = role_config(fact.role)['etiqueta']
        if index == 0 and ctx.level in ('medio','basico'): role = 'DATO'
        body = piece.body if piece and piece.body else fact.text
        if fact.role == 'reflexion':
            if not piece or not piece.reflections:
                raise ValueError('reflexion: falta redacción por nivel revisada; no se inventa por reglas')
            validate_reflections(piece.reflections, [ctx.level])
            body = piece.reflections[ctx.level]
        if fact.role == 'giro' and not body.casefold().startswith('sin embargo'):
            body = 'Sin embargo, ' + body[0].lower() + body[1:]
        if re.search(r'\b(?:the|from|engineering|leadership|developer|update)\b', body, re.I):
            raise ValueError(f'{fact.claim_id}: texto extranjero requiere traducción editorial')
        if len(body) > CONFIG['limites']['body_caracteres']:
            raise ValueError(f'{fact.claim_id}: body excede límite')
        headline = titles[ctx.level] if index == 0 else None
        stats = extract_stat(fact.text) if fact.role in ('prueba','segunda_prueba') else None
        if stats and (stats.casefold() in body.casefold() or numbers_in(stats) & prominent): stats = None
        qualifier = cover_copy.qualifier if index == 0 and cover_copy else ''
        texts = [text('kicker', role), text('stat', stats, refs),
            text('headline', headline, [f.claim_id for f in facts[:2]]) if index == 0 else text('body', body, refs),
            text('label', qualifier, [f.claim_id for f in facts[:2]]) if qualifier else None,
            text('source', source_label(facts[:2] if index == 0 else [fact]), refs), text('handle', ctx.handle)]
        diagram = piece.diagram if piece and piece.diagram else diagram_for(fact)
        if index == 0 and not image:
            diagram = {'kind':'timeline','label':'Lo que está en juego',
                'items':[{'label':'Contexto','detail':qualifier or source_label([fact])}], 'claim_ids':refs}
        validate_diagram(diagram, {f.claim_id for f in facts})
        from .amarillista_visuals import prominent_numbers
        if fact.role != 'portada' and prominent_numbers(diagram) & prominent:
            diagram = {'kind':'timeline','label':'El contexto del hecho',
                'items':[{'label':'Evidencia','detail':fact.text}], 'claim_ids':refs}
        overlay = bool(image and index > 0 and fact.role != 'reflexion' and diagram['kind'] in ('comparison','fraction'))
        needed = set(diagram['claim_ids']) if not image or overlay else set()
        page_facts = [f for f in facts if f == fact or f.claim_id in needed or (index == 0 and f in facts[:2])]
        if image: texts.append(text('credit', f'Foto: {image.author or "Autor desconocido"} · {image.license}'))
        special = 'reflexion_' if fact.role == 'reflexion' else ''
        page = slide(index + 1, ID, f'am_{ctx.level}_{special}{"photo" if image else "visual"}', texts, page_facts)
        if image:
            m = _media_ref(image); page['media'] = [m]; page['elements'] = [{'type':'photo','asset_id':m['asset_id'],'value':image.title or 'Imagen de contexto'}]
            if overlay:
                page['elements'].append(diagram_element(diagram))
                page['texts'] = [t for t in page['texts'] if t['role'] != 'stat']
        else:
            page['elements'] = [diagram_element(diagram)]
            page['texts'] = [t for t in page['texts'] if t['role'] != 'stat']
        prominent.update(numbers_in(headline or ''))
        if image and stats and not overlay: prominent.update(numbers_in(stats))
        if not image or overlay: prominent.update(prominent_numbers(diagram))
        pages.append(page)
    question = (cover_copy.questions[ctx.level] if cover_copy and cover_copy.questions else
                cover_copy.question if cover_copy and cover_copy.question else question_for(ctx))
    pages.append(slide(len(pages)+1, ID, f'am_{ctx.level}_close', [text('kicker',ctx.brand),text('question',question),text('cta',CONFIG['cierre']['cta']),text('handle',ctx.handle)], []))
    return pages


def media_query(facts, ctx, extras):
    return (extras.get('image_query') or ctx.topic or ctx.hook, None)

STRATEGY = Strategy(id=ID,name='Amarillista',description='Golpe, pruebas, giro, verdad, reflexión y cierre con fuentes.',goal=CONFIG['objetivo'],template_id=CONFIG['predeterminado']['template_id'],facts_needed=CONFIG['seleccion']['minimo_hechos'],headline_max=CONFIG['titulo']['max_caracteres_unicode_nfc'],body_max=CONFIG['limites']['body_caracteres'],brief='Tensión proporcionada, conservar alcance y causalidad; no inventar hechos.',pick=pick,build=build,needs_media=True,media_query=media_query)
