"""Read-only checks of the public demo/private project storage contract."""
from pathlib import Path
import json


def audit_layout(templates: Path, profile: Path | None = None):
    findings = []

    def finding(kind, path, expected):
        findings.append({'kind': kind, 'path': str(path), 'expected': expected})

    sandbox = templates / 'sandbox'
    if sandbox.is_symlink():
        finding('symbolic_root', sandbox, 'real repository directory')
        return findings
    if sandbox.is_dir():
        for category in sorted(sandbox.iterdir()):
            if category.is_symlink():
                finding('symbolic_category', category, 'real directory')
                continue
            if not category.is_dir() or category.name.startswith(('.', '_')):
                continue
            if category.name == 'referencias':
                if any(category.iterdir()):
                    finding('references_in_repository', category, 'profile/sandbox/referencias')
                continue
            for project in sorted(category.iterdir()):
                if project.is_symlink():
                    finding('symbolic_project', project, 'no compatibility symlinks')
                    continue
                if not project.is_dir() or project.name in {'tools', 'prompts'}:
                    continue
                if project.name == '_referencias':
                    finding('references_in_repository', project, 'profile/sandbox/referencias')
                elif not project.name.startswith(('.', '_')):
                    finding('project_in_repository_sandbox', project, 'profile/sandbox')

    definitions = templates/'_tools/design-definitions'
    for file in sorted(definitions.glob('*/design.json')):
        if file.is_symlink() or file.parent.is_symlink():
            finding('symbolic_definition', file, 'regular contract file')
            continue
        try:
            design = json.loads(file.read_text())
        except (OSError, ValueError):
            finding('invalid_definition', file, 'valid design contract')
            continue
        if not isinstance(design, dict):
            finding('invalid_definition', file, 'design object')
            continue
        marker = design.get('production_template') or {}
        if not isinstance(marker, dict):
            finding('invalid_definition', file, 'principal demo object')
            continue
        if marker.get('demo') is True:
            if design.get('state') != 'produccion':
                finding('principal_design_in_test', file, 'production design and engine')
            engine = design.get('engine_id') or ''
            root = design.get('engine_root') or ('' if engine.startswith('explainer-kit') else 'sandbox/'+engine)
            if root.startswith('sandbox/'):
                finding('principal_engine_in_sandbox', file, 'explicit production engine_root')

    if profile and (profile/'productions').is_dir():
        for file in sorted((profile/'productions').glob('*/*/manifest.json')):
            if file.is_symlink() or file.parent.is_symlink() or file.parent.parent.is_symlink():
                finding('symbolic_profile_project', file, 'real profile project')
                continue
            try:
                manifest = json.loads(file.read_text())
                if not isinstance(manifest, dict):
                    finding('invalid_manifest', file, 'project object')
                    continue
                if manifest.get('demo') is True:
                    finding('principal_demo_in_profile', file.parent, 'review for registered repository demo')
            except (OSError, ValueError):
                finding('invalid_manifest', file, 'valid project manifest')
    return findings
