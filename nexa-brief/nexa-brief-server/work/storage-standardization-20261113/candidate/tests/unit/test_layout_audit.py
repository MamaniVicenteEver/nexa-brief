import json
from src.core.explainer.layout_audit import audit_layout


def test_only_shared_engines_tools_and_docs_are_allowed_in_repository_sandbox(tmp_path):
    templates=tmp_path/'templates'
    for path in ['sandbox/nodehistory/_atlas','sandbox/nodeaction/tools','sandbox/nodeaction/prompts']:
        (templates/path).mkdir(parents=True)
    assert audit_layout(templates)==[]
    project=templates/'sandbox/nodehistory/memorias-demo'
    project.mkdir()
    assert audit_layout(templates)[0]['kind']=='project_in_repository_sandbox'


def test_repository_references_must_be_in_profile(tmp_path):
    templates=tmp_path/'templates'
    (templates/'sandbox/referencias/nodehistory/test').mkdir(parents=True)
    assert audit_layout(templates)[0]['kind']=='references_in_repository'


def test_principal_demo_cannot_leave_design_and_engine_in_test(tmp_path):
    templates=tmp_path/'templates'
    file=templates/'_tools/design-definitions/atlas/design.json'
    file.parent.mkdir(parents=True)
    file.write_text(json.dumps({'state':'prueba','engine_id':'nodehistory/_atlas',
                               'production_template':{'demo':True}}))
    assert {r['kind'] for r in audit_layout(templates)}=={'principal_design_in_test','principal_engine_in_sandbox'}


def test_correct_principal_and_private_episode_pass_audit(tmp_path):
    templates=tmp_path/'templates'
    file=templates/'_tools/design-definitions/atlas/design.json'
    file.parent.mkdir(parents=True)
    file.write_text(json.dumps({'state':'produccion','engine_id':'stable-id',
                               'engine_root':'nodeatlas/atlas/_atlas','production_template':{'demo':True}}))
    profile=tmp_path/'profile'
    episode=profile/'productions/nodeatlas/video/manifest.json'
    episode.parent.mkdir(parents=True)
    episode.write_text(json.dumps({'demo':False}))
    assert audit_layout(templates,profile)==[]
    episode.write_text(json.dumps({'demo':True}))
    assert audit_layout(templates,profile)[0]['kind']=='principal_demo_in_profile'


def test_project_symlinks_are_reported_without_traversal(tmp_path):
    templates=tmp_path/'templates'
    category=templates/'sandbox/nodehistory'
    category.mkdir(parents=True)
    outside=tmp_path/'outside'
    outside.mkdir()
    (category/'escape').symlink_to(outside)
    assert audit_layout(templates)[0]['kind']=='symbolic_project'
