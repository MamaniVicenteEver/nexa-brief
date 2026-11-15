"""Plan conservative renames of known NodeMotion workspace artifacts.

Historical text and editorial data are never rewritten. A JSON string that is an
exact operational reference blocks its project; historical retired_files are
left as evidence. Review the JSON plan before applying it to an idle profile.
"""
from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path

NAMES = {
    "work/instrucciones": "work/instructions",
    "work/informes": "work/reports",
    "work/guion.json": "work/script.json",
    "INFORME.md": "REPORT.md",
}


def _digest(path: Path) -> str:
    h = hashlib.sha256()
    entries = [path] if path.is_file() else [path, *sorted(path.rglob("*"))]
    for item in entries:
        if item.is_symlink() or not (item.is_dir() or item.is_file()):
            raise ValueError(f"unsupported workspace entry: {item}")
        h.update(("." if item == path else item.relative_to(path).as_posix()).encode())
        h.update(b"\0d\0" if item.is_dir() else b"\0f\0")
        if item.is_file():
            with item.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    h.update(chunk)
    return h.hexdigest()


def _references(project: Path, names: list[str]) -> list[str]:
    found = []
    def visit(value: object, location: str, historical: bool = False) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, f"{location}.{key}", historical or key == "retired_files")
        elif isinstance(value, list):
            for child in value:
                visit(child, location + "[]", historical)
        elif isinstance(value, str) and not historical:
            for name in names:
                absolute = str(project / name)
                if value in (name, absolute) or value.startswith((name + "/", absolute + "/")):
                    found.append(location)
    for file in sorted(project.rglob("*.json")):
        relative = file.relative_to(project)
        if relative.parts[:2] == ("work", "results") or file.name == "prompts-history.json":
            continue
        if file.is_symlink():
            raise ValueError(f"symlink in JSON inventory: {file}")
        try:
            value = json.loads(file.read_text(encoding="utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            raise ValueError(f"invalid JSON in project: {file}") from None
        visit(value, file.relative_to(project).as_posix())
    return found


def plan_workspace_names(root: Path) -> dict:
    root = Path(root)
    if root.is_symlink() or not root.is_dir() or root.resolve() != root.absolute():
        raise ValueError("workspace root must be an existing non-symlink path")
    actions, blocked = [], []
    for project in sorted(root.iterdir()):
        if project.is_symlink() or not project.is_dir():
            continue
        try:
            found = []
            for old, new in NAMES.items():
                source, target = project / old, project / new
                if source.is_symlink() or target.is_symlink():
                    raise ValueError(f"symlink in rename: {old}")
                if source.exists():
                    if target.exists():
                        raise ValueError(f"destination exists: {new}")
                    if source.parent.is_symlink():
                        raise ValueError(f"symlink parent: {old}")
                    found.append({"old": old, "new": new, "sha256": _digest(source)})
            if found:
                refs = _references(project, [x["old"] for x in found])
                if refs:
                    raise ValueError("operational JSON references require review: " + ", ".join(refs))
                actions.append({"project": project.name, "renames": found})
        except (OSError, ValueError) as exc:
            blocked.append({"project": project.name, "reason": str(exc)})
    return {"root": str(root), "projects": actions, "blocked": blocked}


def _rename_exclusive(source: Path, target: Path) -> None:
    # Linux renameat2 atomically refuses an existing destination, including empty directories.
    libc = ctypes.CDLL(None, use_errno=True)
    rename = libc.renameat2
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(source), -100, os.fsencode(target), 1) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code), str(target))


def apply_workspace_names(plan: dict) -> None:
    root = Path(plan["root"])
    fresh = plan_workspace_names(root)
    if fresh != plan:
        raise ValueError("workspace changed; regenerate and review plan")
    for project in plan["projects"]:
        for item in project["renames"]:
            source = root / project["project"] / item["old"]
            target = root / project["project"] / item["new"]
            if _digest(source) != item["sha256"]:
                raise ValueError(f"workspace changed: {source}")
            _rename_exclusive(source, target)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--apply-plan", type=Path, help="apply a previously reviewed JSON plan")
    args = parser.parse_args()
    if args.apply_plan:
        plan = json.loads(args.apply_plan.read_text(encoding="utf-8"))
        if str(args.root) != plan["root"]:
            raise ValueError("plan root differs from requested root")
        apply_workspace_names(plan)
    else:
        print(json.dumps(plan_workspace_names(args.root), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
