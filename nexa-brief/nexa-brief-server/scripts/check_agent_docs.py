#!/usr/bin/env python3
"""Comprueba las entradas de instrucciones y sus referencias locales estáticas."""
from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import unquote

SERVER = Path(__file__).resolve().parents[1]
ROOT = SERVER.parent
SKILLS = SERVER / 'src/skills'
PROFILE = Path('/home/alfred/.local/share/nexa-brief/profiles/profesional')
LINK = re.compile(r'(?<!!)\[[^\]]*\]\(([^)]+)\)')
INLINE = re.compile(r'(?<!`)`([^`\n]+)`(?!`)')


def inventory(root: Path, profile: Path | None = None):
    server = root / 'nexa-brief-server'
    templates = server / 'src/templates'
    sandbox = templates / 'sandbox'
    routers = [root / 'AGENTS.md', server / 'AGENTS.md', templates / 'AGENTS.md',
               sandbox / 'AGENTS.md', sandbox / 'SANDBOX.md', templates / '_tools/explainer-kit/AGENTS.md']
    routers += list(sandbox.glob('*/AGENTS.md')) + list((templates / 'nodeatlas').rglob('AGENTS.md'))
    skills = [root / '.claude/skills/nuevo-prototipo/SKILL.md', sandbox / 'PROTOTIPO.md',
              sandbox / 'nodeaction/_vida/SKILL.md']
    skills += list((server / 'src/skills').rglob('SKILL.md'))
    skills += list((templates / '_tools/explainer-kit/designs').glob('*/QUICK.md'))
    for base in [templates / 'nodeatlas', sandbox / 'nodehistory/_atlas']:
        for name in ['SKILL.md', 'AGENTE.md', 'QUICK.md', 'GUION.md']:
            skills += list(base.rglob(name))
    claudes = [root / 'CLAUDE.md', templates / 'CLAUDE.md']
    claudes += list(sandbox.glob('*/CLAUDE.md')) + list((templates / 'nodeatlas').rglob('CLAUDE.md'))
    extra = [server / 'src/skills/README.md', templates / '_tools/explainer-kit/guides/orquestacion.md', server / 'src/skills/nodemotion/promo/CALIDAD.md']
    if profile:
        routers += [profile / 'AGENTS.md', profile / 'sandbox/AGENTS.md', profile / 'sandbox/SANDBOX.md',
                    profile / 'sandbox/EXPLAINER.md', profile / 'productions/AGENTS.md']
        routers += list((profile / 'sandbox').glob('*/AGENTS.md'))
        skills += [profile / 'sandbox/PROTOTIPO.md']
        claudes += [profile / 'CLAUDE.md', profile / 'sandbox/CLAUDE.md', profile / 'productions/CLAUDE.md']
        claudes += list((profile / 'sandbox').glob('*/CLAUDE.md'))
        claudes += list((profile / 'productions').glob('*/CLAUDE.md'))
    return [list(dict.fromkeys(x)) for x in (routers, skills, claudes, extra)]


def local_link(path: Path, target: str):
    target = unquote(target.split()[0].split('#', 1)[0])
    if not target or re.match(r'^[a-zA-Z][\w+.-]*:', target) or target.startswith('//'):
        return None
    return (path.parent / target).resolve()


def check(root: Path, profile: Path | None = None):
    server = root / 'nexa-brief-server'
    skillroot = server / 'src/skills'
    routers, skills, claudes, extra = inventory(root, profile)
    errors = []
    def fail(path, msg): errors.append(f'{path}: {msg}')
    for path in dict.fromkeys(routers + skills + claudes + extra):
        if not path.is_file():
            fail(path, 'archivo de entrada inexistente')
            continue
        content = path.read_text(encoding='utf-8')
        if path in claudes:
            if content.strip() != '@AGENTS.md': fail(path, 'CLAUDE.md debe contener solo @AGENTS.md')
            if not path.with_name('AGENTS.md').is_file(): fail(path, 'falta AGENTS.md hermano')
            continue
        prose = re.sub(r'(?ms)^```[^\n]*\n.*?^```[^\n]*$', '', content)
        links = [local_link(path, m.group(1)) for m in LINK.finditer(INLINE.sub('', prose))]
        opening = re.sub(r'(?s)^---\n.*?\n---\n', '', prose).lstrip()[:600]
        opening_links = [local_link(path, m.group(1)) for m in LINK.finditer(INLINE.sub('', opening))]
        if path in routers and (skillroot / 'README.md').resolve() not in opening_links:
            fail(path, 'router sin enlace al índice')
        if path in skills:
            for name in ('CALIDAD.md', 'ORQUESTACION.md', 'PLANTILLA-BRIEF.md', 'PLANTILLA-INFORME.md'):
                if (skillroot / name).resolve() not in opening_links: fail(path, f'falta enlace estándar a {name}')
            if '`INFORME.md`' not in opening or 'si orquestas' not in opening:
                fail(path, 'bloque estándar incompleto al principio')
            if '## Específico de esta skill' not in content: fail(path, 'falta sección específica')
        for target in links:
            if target is not None and not target.exists(): fail(path, f'enlace inexistente: {target}')
        if path == skillroot / 'README.md':
            for row in prose.splitlines():
                if row.startswith('|'):
                    for ref in INLINE.findall(row):
                        if ('/' in ref or ref.endswith('.json')) and not (path.parent / ref).exists():
                            fail(path, f'ruta del índice inexistente: {ref}')
        # Referencias inequívocas a documentos de instrucciones existentes: los nombres
        # de salida, variables, globos, fragmentos de comandos y ejemplos no son rutas estáticas.
        for match in INLINE.finditer(prose):
            ref = match.group(1)
            if not re.fullmatch(r'(?:\.\.?/|(?:[\w.-]+/)+)[\w.-]+\.md', ref): continue
            if ref.startswith(('work/', 'EP/', 'prompts/config_mapper', 'prompts/vision_extractor')) or ref.endswith(('/INFORME.md', '/RESULT.md', '/PLAN.md', '/BRIEF.md')): continue
            bases = [path.parent, root, server, server / 'src/templates', skillroot, server / 'src/templates/sandbox', server / 'src/templates/_tools/explainer-kit']
            if profile: bases += [profile, profile / 'sandbox']
            if not any((base / ref).exists() for base in bases): fail(path, f'ruta citada inexistente: {ref}')
    return errors, sum(map(len, (routers, skills, claudes, extra)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', type=Path, help='raíz del perfil activo')
    args = parser.parse_args()
    errors, count = check(ROOT, args.profile.resolve() if args.profile else None)
    for error in errors: print(error)
    print(f'{count} entradas; {len(errors)} errores')
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
