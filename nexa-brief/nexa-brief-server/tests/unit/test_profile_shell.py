"""Shell and Compose integration using only synthetic manifests and paths."""
import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest

PROJECT = Path(__file__).resolve().parents[3]


def run(command, tmp_path, **extra):
    env = {"PATH": os.environ["PATH"], "HOME": str(tmp_path),
           "XDG_CONFIG_HOME": str(tmp_path / "config"), "COMPOSE_DISABLE_ENV_FILE": "1", **extra}
    return subprocess.run(command, cwd=PROJECT, env=env, text=True, capture_output=True)


def make_profile(tmp_path, version):
    root = tmp_path / f"profile-{version}"
    root.mkdir()
    (root / "profile.json").write_text(json.dumps({"schema_version": version, "id": f"test{version}", "providers": {}}))
    return root


@pytest.mark.parametrize("version", [1, 2])
def test_profile_path_and_env_return_consistent_paths(tmp_path, version):
    root = make_profile(tmp_path, version)
    script = 'source scripts/profile-env.sh && printf "%s\\n" "$NEXA_DATA_PROFILE" "$NEXA_WEB_DATA_DIR" "$NEXA_CONNECTIONS_DIR" "$NEXA_RENDERS_DIR" "$NEXA_TIKTOK_DATA_DIR"'
    result = run(["bash", "-c", script], tmp_path, NEXA_PROFILE_DIR=str(root))
    assert result.returncode == 0, result.stderr
    private = root / ".system" if version == 2 else root
    assert result.stdout.splitlines() == [f"test{version}", str(private / "web-data"), str(private / "connections"),
                                           str(root / ("renders" if version == 2 else "output")), str(private / "tiktok")]
    result = run(["python3", "scripts/profile-path.py", str(root), "web_data"], tmp_path)
    assert result.returncode == 0 and result.stdout.strip() == str(private / "web-data")


def test_invalid_manifest_fails_without_exporting_empty_paths(tmp_path):
    root = make_profile(tmp_path, 9)
    result = run(["bash", "-c", 'source scripts/profile-env.sh || exit 12'], tmp_path, NEXA_PROFILE_DIR=str(root))
    assert result.returncode == 12
    result = run(["make", "help"], tmp_path, NEXA_PROFILE_DIR=str(root))
    assert result.returncode != 0
    assert "No se pudo resolver el perfil" in result.stderr
    explicit = {"NEXA_PROFILE_DIR": str(root), "NEXA_WEB_DATA_DIR": str(tmp_path / "web"),
                "NEXA_CONNECTIONS_DIR": str(tmp_path / "connections"), "NEXA_RENDERS_DIR": str(tmp_path / "renders"),
                "NEXA_TIKTOK_DATA_DIR": str(tmp_path / "tiktok")}
    result = run(["bash", "-c", 'source scripts/profile-env.sh || exit 12'], tmp_path, **explicit)
    assert result.returncode == 12
    result = run(["make", "help"], tmp_path, **explicit)
    assert result.returncode != 0 and "No se pudo resolver el perfil" in result.stderr


def test_make_help_without_profile_remains_usable(tmp_path):
    result = run(["make", "help"], tmp_path, NEXA_PROFILE_DIR=str(tmp_path / "absent"))
    assert result.returncode == 0, result.stderr
    assert "seed-admin" in result.stdout


@pytest.mark.parametrize("version", [1, 2])
def test_compose_config_uses_selected_profile_paths(tmp_path, version):
    if not shutil.which("docker"):
        pytest.skip("docker compose is unavailable")
    root = make_profile(tmp_path, version)
    empty = tmp_path / "empty-config"
    empty.write_text("")
    command = f'source scripts/profile-env.sh && docker compose --env-file "{empty}" config --no-env-resolution --format json'
    result = run(["bash", "-c", command], tmp_path, NEXA_PROFILE_DIR=str(root))
    if result.returncode and "not a docker command" in result.stderr:
        pytest.skip("docker compose plugin is unavailable")
    assert result.returncode == 0, result.stderr
    config = json.loads(result.stdout)
    private = root / ".system" if version == 2 else root
    volumes = {entry["target"]: entry["source"] for entry in config["services"]["web"]["volumes"]}
    assert volumes["/app/data"] == str(private / "web-data")
    api = {entry["target"]: entry["source"] for entry in config["services"]["api"]["volumes"]}
    assert api["/app/output"] == str(root / ("renders" if version == 2 else "output"))
    assert api["/app/accounts"] == str(private / "connections")
    assert config["services"]["web"]["environment"]["NEXA_PROFILE_MANIFEST"] == "/app/profile.json"


def test_connection_unit_quotes_profile_path_and_rejects_invalid_port(tmp_path):
    project = tmp_path / "project space %"
    scripts = project / "scripts"
    scripts.mkdir(parents=True)
    for name in ("install-connections-service.sh", "profile-env.sh", "profile-path.py"):
        shutil.copy2(PROJECT / "scripts" / name, scripts / name)
    config = project / "nexa-brief-server/src/config"
    config.mkdir(parents=True)
    for name in ("__init__.py", "profile_layout.py", "storage_profile.py"):
        source = PROJECT / "nexa-brief-server/src/config" / name
        if source.exists():
            shutil.copy2(source, config / name)
    tik = project / "nexa-tiktok/.venv/bin"
    tik.mkdir(parents=True)
    (tik / "python").write_text("#!/bin/sh\nexit 0\n")
    (tik / "python").chmod(0o755)
    (scripts / "start-connections.sh").write_text("#!/bin/sh\nexit 0\n")
    (scripts / "start-connections.sh").chmod(0o755)
    fakebin = tmp_path / "bin"
    fakebin.mkdir()
    (fakebin / "systemctl").write_text("#!/bin/sh\nexit 0\n")
    (fakebin / "systemctl").chmod(0o755)
    root = tmp_path / "profile space %"
    root.mkdir()
    manifest = root / "profile.json"
    manifest.write_text(json.dumps({"schema_version": 2, "id": "isolated", "services": {"tiktok": {"port": 8101}}}))
    env = {"PATH": str(fakebin) + ":" + os.environ["PATH"], "HOME": str(tmp_path),
           "XDG_CONFIG_HOME": str(tmp_path / "config"), "NEXA_PROFILE_DIR": str(root)}
    result = subprocess.run(["bash", str(scripts / "install-connections-service.sh")], env=env, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    unit = (tmp_path / "config/systemd/user/nexa-tiktok-isolated.service").read_text()
    assert f'Environment="NEXA_TIKTOK_DATA_DIR={str(root).replace("%", "%%")}/.system/tiktok"' in unit
    assert f'WorkingDirectory="{str(project).replace("%", "%%")}/nexa-tiktok"' in unit
    assert "--port 8101" in unit
    manifest.write_text(json.dumps({"schema_version": 2, "id": "isolated", "services": {"tiktok": {"port": "8101 --bad"}}}))
    result = subprocess.run(["bash", str(scripts / "install-connections-service.sh")], env=env, text=True, capture_output=True)
    assert result.returncode != 0


def test_v2_rejects_foreign_overrides_but_accepts_canonical_aliases(tmp_path):
    root = make_profile(tmp_path, 2)
    other = tmp_path / "other-profile"
    foreign = other / ".system/web-data"
    foreign.mkdir(parents=True)
    wrong = {"NEXA_PROFILE_DIR": str(root), "NEXA_WEB_DATA_DIR": str(foreign)}
    shell = run(["bash", "-c", 'source scripts/profile-env.sh || exit 12'], tmp_path, **wrong)
    assert shell.returncode == 12 and "does not match" in shell.stderr
    result = run(["make", "help"], tmp_path, **wrong)
    assert result.returncode != 0
    result = run(["make", "help", f"NEXA_WEB_DATA_DIR={foreign}"], tmp_path, NEXA_PROFILE_DIR=str(root))
    assert result.returncode != 0
    expected = root / ".system/web-data"
    expected.mkdir(parents=True)
    alias = tmp_path / "web-alias"
    alias.symlink_to(expected, target_is_directory=True)
    right = {"NEXA_PROFILE_DIR": str(root), "NEXA_WEB_DATA_DIR": str(alias)}
    assert run(["bash", "-c", "source scripts/profile-env.sh"], tmp_path, **right).returncode == 0
    assert run(["make", "help"], tmp_path, **right).returncode == 0


def test_v1_preserves_explicit_path_overrides(tmp_path):
    root = make_profile(tmp_path, 1)
    alternate = tmp_path / "legacy-alternate"
    env = {"NEXA_PROFILE_DIR": str(root), "NEXA_WEB_DATA_DIR": str(alternate)}
    result = run(["bash", "-c", 'source scripts/profile-env.sh && printf "%s" "$NEXA_WEB_DATA_DIR"'], tmp_path, **env)
    assert result.returncode == 0 and result.stdout == str(alternate)
    assert run(["make", "help"], tmp_path, **env).returncode == 0


def test_make_treats_override_path_as_data(tmp_path):
    root = make_profile(tmp_path, 2)
    sentinel = tmp_path / "should-not-exist"
    wrong = f"{tmp_path}/bad`touch {sentinel}`"
    result = run(["make", "help"], tmp_path, NEXA_PROFILE_DIR=str(root), NEXA_WEB_DATA_DIR=wrong)
    assert result.returncode != 0
    assert not sentinel.exists()
