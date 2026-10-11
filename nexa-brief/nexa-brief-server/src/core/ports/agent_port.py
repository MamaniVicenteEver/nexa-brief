"""Agent Port — un agente de código local (Claude Code, Codex…) que trabaja solo.

Distinto de `AIPort`: un agente no solo responde texto, también lee y escribe
archivos y corre comandos dentro de `cwd` (así produce un video del
explainer-kit siguiendo su AGENTS.md). Corre con las suscripciones de la
máquina donde vive el servidor; más adelante se agregan agentes por API
(DeepSeek, etc.) como otro adaptador de este mismo puerto.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


class AgentUnavailableError(RuntimeError):
    """El CLI del agente no está instalado o no se encontró."""


@dataclass(frozen=True)
class AgentScope:
    """Qué puede tocar un agente sin supervisión.

    writable_dir: única carpeta (relativa a cwd) donde puede escribir.
    commands: prefijos de comando que puede ejecutar (p. ej. el CLI del kit).
    """

    writable_dir: str
    commands: tuple[str, ...] = ()
    # Carpeta (relativa a cwd) que el sandbox del sistema deja escribir a
    # agentes como Codex, que no filtran por ruta sino por directorio de
    # trabajo. Por defecto, writable_dir.
    os_sandbox_dir: str | None = None
    # Rutas absolutas extra que el agente puede escribir (p. ej. el estado del kit).
    extra_writable: tuple[str, ...] = ()


@dataclass
class AgentRunResult:
    exit_code: int
    last_message: str      # respuesta final del agente (o la cola de la salida)
    duration_seconds: float
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


class AgentRunnerPort(ABC):
    name: str

    @abstractmethod
    def available(self) -> bool:
        """True si el CLI existe en esta máquina."""

    @abstractmethod
    async def run(
        self,
        prompt: str,
        *,
        cwd: Path,
        log_path: Path,
        timeout_seconds: float,
        scope: AgentScope | None = None,
    ) -> AgentRunResult:
        """Ejecuta el agente con `prompt` en `cwd`; toda su salida va a `log_path`.

        scope=None: solo lectura (respuestas de texto/JSON). Con scope: escribe
        solo en `scope.writable_dir` y corre solo `scope.commands`.
        """
