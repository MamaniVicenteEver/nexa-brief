import fcntl
import json
import logging
import os
import re
import shutil
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter

from nexa_tiktok.domain.models import Account, Job, Video

ALIAS = re.compile(r'[a-z0-9][a-z0-9_-]{0,31}\Z')
ID = re.compile(r'[A-Za-z0-9_-]{1,100}\Z')
VIDEOS = TypeAdapter(list[Video])


def validate_alias(alias: str) -> str:
    if not ALIAS.fullmatch(alias):
        raise ValueError('Alias inválido.')
    return alias


class RestoreConflict(ValueError):
    """A recovery must never roll back a readable live file."""


class JsonStore:
    def __init__(self, root: Path):
        self.root = Path(root).absolute()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.root.chmod(0o700)
        self.degraded: set[str] = set()
        quarantine = self.root / 'quarantine'
        for marker in quarantine.rglob('*.unresolved'):
            self.degraded.add(str(marker.relative_to(quarantine))[:-11])

    @contextmanager
    def locked(self) -> Iterator[None]:
        fd = os.open(self.root / '.store.lock', os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            # Other store instances (browser checks, for example) can discover
            # corruption. Refresh persistent barriers before every operation.
            self.degraded = {
                str(marker.relative_to(self.root / 'quarantine'))[:-11]
                for marker in (self.root / 'quarantine').rglob('*.unresolved')
            }
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def _account_dir(self, alias: str) -> Path:
        return self.root / 'accounts' / validate_alias(alias)

    def _job_path(self, job_id: str) -> Path:
        if not ID.fullmatch(job_id):
            raise ValueError('ID inválido.')
        return self.root / 'jobs' / f'{job_id}.json'

    def _backup_dir(self, path: Path) -> Path:
        return self.root / 'backups' / path.relative_to(self.root)

    def _validate(self, path: Path, value: Any) -> Any:
        parts = path.relative_to(self.root).parts
        if len(parts) == 3 and parts[0] == 'accounts' and parts[2] == 'account.json':
            account = Account.model_validate(value, strict=True)
            if account.alias != parts[1] or not ALIAS.fullmatch(account.alias):
                raise ValueError('Alias de cuenta inconsistente.')
        elif len(parts) == 3 and parts[0] == 'accounts' and parts[2] == 'videos.json':
            VIDEOS.validate_python(value, strict=True)
        elif len(parts) == 2 and parts[0] == 'jobs' and path.suffix == '.json':
            job = Job.model_validate(value, strict=True)
            if job.id != path.stem or not ID.fullmatch(job.id) or not ALIAS.fullmatch(job.alias):
                raise ValueError('Identidad de trabajo inconsistente.')
            # Older valid files may omit fields with schema defaults, which
            # the worker expects to exist. Preserve any unknown metadata.
            value = {**job.model_dump(), **value}
        return value

    def _backup(self, path: Path) -> None:
        if not path.exists():
            return
        # Never preserve corrupt data as a valid backup.
        self._validate(path, json.loads(path.read_text(encoding='utf-8')))
        directory = self._backup_dir(path)
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        stamp = datetime.now(UTC).strftime('%Y%m%dT%H%M%S.%fZ')
        target = directory / (stamp + '.json')
        fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        saved = False
        try:
            with os.fdopen(fd, 'wb') as output, path.open('rb') as source:
                shutil.copyfileobj(source, output)
                output.flush()
                os.fsync(output.fileno())
            directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
            saved = True
        finally:
            if not saved:
                target.unlink(missing_ok=True)
        entries = sorted(directory.glob('*.json'), reverse=True)
        daily = set()
        for entry in entries:
            day = entry.name[:8]
            if len(daily) < 14:
                daily.add(day)
                continue
            if entry not in entries[:20]:
                entry.unlink()
        # Keep only the newest backup for older retained days.
        seen = set()
        for entry in entries[20:]:
            if not entry.exists():
                continue
            day = entry.name[:8]
            if day in seen:
                entry.unlink()
            else:
                seen.add(day)

    def _read(self, path: Path, default: Any = None) -> Any:
        relative = str(path.relative_to(self.root))
        if not path.exists():
            if relative not in self.degraded:
                return default
        else:
            try:
                value = self._validate(path, json.loads(path.read_text(encoding='utf-8')))
            except (ValueError, UnicodeError):
                pass
            else:
                if relative in self.degraded:
                    # The recovered replacement may have reached disk just
                    # before a crash prevented removal of its marker.
                    if path.parent.name == 'jobs' and isinstance(value, dict):
                        value['state'] = 'needs_review'
                        value['error'] = {'code': 'restored_job', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
                        self._write(path, value, recovering=True)
                    self._resolved(path)
                return value
        quarantine = self.root / 'quarantine' / path.relative_to(self.root)
        quarantine.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        marker = quarantine.with_name(quarantine.name + '.unresolved')
        # Persist the barrier BEFORE removing the corrupt file. A restart in
        # this window must not treat a lost job/account as a new empty store.
        marker.touch(mode=0o600)
        with marker.open('rb') as stream:
            os.fsync(stream.fileno())
        directory_fd = os.open(marker.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        self.degraded.add(relative)
        if path.exists():
            stamp = datetime.now(UTC).strftime('%Y%m%dT%H%M%S.%fZ')
            path.replace(quarantine.with_name(quarantine.name + '.' + stamp))
            logging.getLogger(__name__).error('JSON corrupto en cuarentena: %s', relative)
        for backup in sorted(self._backup_dir(path).glob('*.json'), reverse=True):
            try:
                value = self._validate(path, json.loads(backup.read_text(encoding='utf-8')))
            except (ValueError, UnicodeError, OSError):
                continue
            if path.parent.name == 'jobs' and isinstance(value, dict):
                value['state'] = 'needs_review'
                value['error'] = {'code': 'restored_job', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
            self._write(path, value, recovering=True)
            self._resolved(path)
            logging.getLogger(__name__).warning('JSON restaurado desde respaldo: %s', relative)
            return value
        raise RuntimeError('Datos corruptos sin respaldo válido: ' + relative)

    def _resolved(self, path: Path) -> None:
        self.degraded.discard(str(path.relative_to(self.root)))
        marker = self.root / 'quarantine' / path.relative_to(self.root)
        marker.with_name(marker.name + '.unresolved').unlink(missing_ok=True)

    def _write(self, path: Path, value: Any, *, recovering: bool = False) -> None:
        if not recovering and str(path.relative_to(self.root)) in self.degraded:
            raise RuntimeError('Datos pendientes de recuperación; no se sobrescribieron.')
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        path.parent.chmod(0o700)
        if path.exists():
            if not recovering:
                self._read(path)
            self._backup(path)
        fd, name = tempfile.mkstemp(prefix='.tmp-', dir=path.parent)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as file:
                json.dump(value, file, ensure_ascii=False)
                file.flush()
                os.fsync(file.fileno())
            os.replace(name, path)
            directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    def list_backups(self) -> list[dict[str, str]]:
        result = []
        for path in sorted((self.root / 'backups').rglob('*.json'), reverse=True):
            # account.json/videos.json are DIRECTORY names in this layout.
            # They must not appear as snapshots or as last_backup_at values.
            if not path.is_file() or not re.fullmatch(r'\d{8}T\d{6}\.\d{6}Z', path.stem):
                continue
            result.append({'file': str(path.parent.relative_to(self.root / 'backups')), 'timestamp': path.stem})
        return result

    def restore_backup(self, file: str, timestamp: str) -> None:
        relative = Path(file)
        if relative.is_absolute() or '..' in relative.parts or not re.fullmatch(r'\d{8}T\d{6}\.\d{6}Z', timestamp):
            raise ValueError('Respaldo inválido.')
        if not ((len(relative.parts) == 3 and relative.parts[0] == 'accounts' and relative.name in {'account.json', 'videos.json'} and ALIAS.fullmatch(relative.parts[1])) or
                (len(relative.parts) == 2 and relative.parts[0] == 'jobs' and relative.suffix == '.json' and ID.fullmatch(relative.stem))):
            raise ValueError('Archivo inválido.')
        with self.locked():
            backup = self.root / 'backups' / relative / (timestamp + '.json')
            target = self.root / relative
            value = self._validate(target, json.loads(backup.read_text(encoding='utf-8')))
            if target.exists():
                try:
                    self._read(target)
                except RuntimeError:
                    pass
                else:
                    raise RestoreConflict('El archivo actual es legible; no se sobrescribió.')
            if relative.parts[0] == 'jobs' and isinstance(value, dict):
                value['state'] = 'needs_review'
                value['error'] = {'code': 'restored_job', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
            self._write(target, value, recovering=True)
            self._resolved(target)

    def get_account(self, alias: str) -> dict[str, Any] | None:
        with self.locked():
            return self._read(self._account_dir(alias) / 'account.json')

    def put_account(self, alias: str, account: dict[str, Any]) -> None:
        with self.locked():
            self._write(self._account_dir(alias) / 'account.json', account)

    def list_accounts(self) -> list[dict[str, Any]]:
        with self.locked():
            values = []
            for path in sorted((self.root / 'accounts').glob('*/account.json')):
                try:
                    values.append(self._read(path))
                except RuntimeError:
                    continue
            return values

    def delete_account(self, alias: str) -> bool:
        with self.locked():
            path = self._account_dir(alias)
            if not path.exists():
                return False
            if path.is_symlink():
                raise ValueError('Perfil inválido.')
            shutil.rmtree(path)
            return True

    def get_videos(self, alias: str) -> list[dict[str, Any]]:
        with self.locked():
            return self._read(self._account_dir(alias) / 'videos.json', [])

    def put_videos(self, alias: str, videos: list[dict[str, Any]]) -> None:
        with self.locked():
            self._write(self._account_dir(alias) / 'videos.json', videos)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.locked():
            return self._read(self._job_path(job_id))

    def put_job(self, job: dict[str, Any]) -> None:
        with self.locked():
            self._write(self._job_path(job['id']), job)

    def _jobs(self) -> list[dict[str, Any]]:
        values = []
        for path in sorted((self.root / 'jobs').glob('*.json')):
            try:
                values.append(self._read(path))
            except RuntimeError:
                continue
        return values

    def list_jobs(self) -> list[dict[str, Any]]:
        with self.locked():
            return self._jobs()

    def create_job(self, job: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        with self.locked():
            if any(item.startswith('jobs/') for item in self.degraded):
                raise RuntimeError('No se pueden crear trabajos hasta recuperar los datos de trabajos.')
            key = job.get('idempotency_key')
            existing_jobs = self._jobs()
            if any(item.startswith('jobs/') for item in self.degraded):
                raise RuntimeError('No se pueden crear trabajos hasta recuperar los datos de trabajos.')
            if key:
                for existing in existing_jobs:
                    if existing.get('idempotency_key') == key:
                        return existing, False
            self._write(self._job_path(job['id']), job)
            return job, True
