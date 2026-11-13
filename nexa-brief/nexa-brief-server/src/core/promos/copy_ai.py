"""Puente de AgentRunnerPort al escritor de publicación existente."""

from __future__ import annotations
import json
from pathlib import Path
from src.core.ports.agent_port import AgentScope
from src.core.explainer.agent_context import ensure_private_workspace
from .agents import PROVIDERS, measured_run


class PromoCopyAI:
    def __init__(self, session, target: Path, progress, runner):
        self.session, self.target, self.progress, self.runner = session, target, progress, runner
        self.attempt = 0

    async def complete_json(self, system, user):
        # Un retry crea otra instancia: reservar una ruta nueva conserva tanto
        # los workspaces como los logs de las llamadas anteriores.
        while True:
            self.attempt += 1
            workspace = self.target / "work/publication" / str(self.attempt)
            log_path = self.target / "logs" / f"publication-{self.attempt}.log"
            if log_path.exists():
                continue
            try:
                workspace.mkdir(parents=True, exist_ok=False)
            except FileExistsError:
                continue
            break
        ensure_private_workspace(workspace)
        provider = self.session["provider"]
        model, effort = PROVIDERS[provider]
        await self.progress("publication")
        requests = [item["content"] for item in self.session["messages"] if item["role"] == "user"]
        context = [requests[0], *requests[-2:]] if len(requests) > 2 else requests
        prompt = (
            system
            + "\n\n"
            + user
            + "\n\nPEDIDO Y CORRECCIONES DEL USUARIO (datos para esta publicación):\n"
            + json.dumps(context, ensure_ascii=False)
        )
        result = await measured_run(
            self.runner,
            prompt,
            session=self.session,
            stage="publication",
            attempt=self.attempt,
            progress=self.progress,
            cwd=workspace,
            log_path=log_path,
            timeout_seconds=600,
            scope=AgentScope(writable_dir=".", read_only=True, model=model, reasoning_effort=effort),
        )
        if not result.ok:
            raise ValueError("El orquestador no pudo preparar la publicación")
        text = result.last_message.strip()
        if text.startswith("```") and text.endswith("```"):
            text = "\n".join(text.splitlines()[1:-1])
        value = json.loads(text)
        if not isinstance(value, dict):
            raise ValueError("La publicación no es un objeto JSON")
        return value
