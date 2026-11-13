"""Audit only; does not create, delete, move, register or generate anything."""
import json
from src.config.settings import settings
from src.config.profile_layout import layout_for_settings
from src.core.explainer.layout_audit import audit_layout

if __name__ == '__main__':
    findings = audit_layout(settings.templates_dir, layout_for_settings(settings).root)
    print(json.dumps({'findings':findings, 'count':len(findings)}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if findings else 0)
