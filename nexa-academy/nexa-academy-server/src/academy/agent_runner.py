"""Application service for executing a registered Academy agent."""

from __future__ import annotations

import structlog

from src.academy.agents import get_agent
from src.academy.template_catalog import visual_director_context
from src.adapters.ai.factory import get_analysis_ai


logger = structlog.get_logger(__name__)


class AcademyAgentRunner:
    """Runs one scoped agent through the existing hexagonal AI port."""

    async def run(self, agent_id: str, context: dict, user_prompt: str) -> dict:
        agent = get_agent(agent_id)
        visual_context = ""
        if agent_id == "visual_director":
            visual_context = (
                "\n\nCatálogo visual aprobado, en JSON. Solo puedes elegir y completar "
                "una de estas plantillas; no puedes crear otra:\n"
                f"{visual_director_context(context)}"
            )
        prompt = (
            "Contexto aprobado de la tarea, en JSON:\n"
            f"{context}\n\n"
            "Solicitud del usuario:\n"
            f"{user_prompt.strip()}\n\n"
            f"{visual_context}\n\n"
            "Devuelve únicamente el JSON definido por tu contrato de salida."
        )
        logger.info(
            "academy_agent_run_start",
            agent_id=agent.id,
            context_keys=sorted(context.keys()),
        )
        result = await get_analysis_ai().complete_json(agent.system_prompt, prompt)
        logger.info(
            "academy_agent_run_done",
            agent_id=agent.id,
            result_keys=sorted(result.keys()),
        )
        return {"agent_id": agent.id, "prompt_version": "academy-agents-v2", "result": result}
