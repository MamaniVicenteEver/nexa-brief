import importlib.util
import json
from pathlib import Path

KIT = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit'
spec = importlib.util.spec_from_file_location('imperio_openings_policy', KIT / 'tools/style_media_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
RULES = policy.policy_for({'design': 'imperio'})


def test_c_no_puede_tomar_prestada_foto_b_que_el_render_no_usa(tmp_path):
    media = tmp_path / 'assets/media'; media.mkdir(parents=True)
    (media / 'b.jpg').write_bytes(b'image')
    (tmp_path / 'publish.json').write_text(json.dumps({'thumbnail': {
        'with_image': {'image': 'b.jpg'}, 'tabloid': {'text': 'EUROPA EN GUERRA', 'image': None}}}))
    errors = []
    policy.check_openings({'design': 'imperio'}, [], RULES, errors, tmp_path)
    assert any('miniatura C' in e for e in errors)
    assert not any('miniatura B' in e for e in errors)


def test_b_y_c_exigen_foto_y_titular_en_storyboard():
    beats = [{'i': i, 'use': component, 'b': {'params': {'text': ''}}}
             for i, component in enumerate(['imperio.introv2', 'common.tabloid'])]
    errors = []
    policy.check_openings({'design': 'imperio'}, beats, RULES, errors)
    assert len(errors) == 4
    errors = []
    for beat in beats:
        beat['b']['params'] = {'text': 'DOS DISPAROS', 'src': 'assets/media/a.jpg'}
    policy.check_openings({'design': 'imperio'}, beats, RULES, errors)
    assert not errors


def test_otros_disenos_y_a_solo_texto_conservan_contrato():
    errors = []
    beats = [{'i': 0, 'use': 'common.tabloid', 'b': {'params': {'text': 'TEXTO'}}}]
    policy.check_openings({'design': 'rough'}, beats, {}, errors)
    policy.check_openings({'design': 'imperio'}, [{'i': 0, 'use': 'imperio.introv1', 'b': {}}], RULES, errors)
    assert not errors


def test_narrativa_y_contexto_real_del_agente_tienen_identidad(tmp_path):
    from src.adapters.narrative.json_repository import JsonNarrativeRepository
    from src.core.explainer.narrative.prompts import production_lines, brief_context
    from src.core.explainer.agent_context import prepare_design_context
    repo = JsonNarrativeRepository(KIT.parents[2] / 'skills/explainer/strategies/narrative')
    story = repo.load(repo.default_id('node_atlas'))
    assert story.id == 'narrative_cinematica_v1'
    assert repo.default_id('node_tech') == 'narrative_amarillista_v2'
    assert 'decisiones' in '\n'.join(production_lines(story, 'node_atlas', None))
    assert brief_context(story, 'node_atlas', None)['id'] == story.id
    # kit_dir explícito prueba la misma copia segura usada por el productor aislado.
    context = prepare_design_context(tmp_path, 'imperio', kit_dir=KIT)
    quick = (context / 'QUICK.md').read_text()
    assert 'imperio-narrador-cinematico-v1' in quick
    assert 'Charon' in quick and 'C / common.tabloid' in quick
    assert 'decisión' in quick and 'música' in quick


def test_campaign_no_cuenta_banderas_como_fotografia_documental():
    errors = []
    beats = [{"i": 0, "t0": 0, "t1": 20, "use": "imperio.campaign", "layer": "main", "b": {"params": {"f1": "assets/flags/germany.svg"}}}]
    catalog = {"imperio.campaign": {"params": {"f1": {"type": "image"}}}}
    result = policy.check({"design": "imperio"}, beats, catalog, [], 20, errors)
    assert result["media"] == []
    assert not errors
