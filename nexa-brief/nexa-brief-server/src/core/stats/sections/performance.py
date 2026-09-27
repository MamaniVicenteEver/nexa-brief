"""Tiempo de generación: total por job y promedio por etapa (del historial)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from src.core import job_tracker
from src.core.stats.context import StatsContext
from src.core.stats.models import PerformanceStats, StageTiming

_EXCLUDED_STAGES = {"publishing", "published"}


def _stage_averages(ctx: StatsContext, job_ids: set[str]) -> list[StageTiming]:
    events_by_job: dict[str, list] = defaultdict(list)
    for event in ctx.history_events:
        if event.job_id in job_ids:
            events_by_job[event.job_id].append(event)

    totals: dict[str, list[float]] = defaultdict(list)
    for job_id, events in events_by_job.items():
        previous = datetime.fromisoformat(ctx.jobs_by_id[job_id]["created_at"])
        for event in sorted(events, key=lambda e: e.created_at):
            at = datetime.fromisoformat(event.created_at)
            if event.stage.value not in _EXCLUDED_STAGES:
                totals[event.stage.value].append(max(0.0, (at - previous).total_seconds()))
            previous = at

    timings = [
        StageTiming(stage=stage, avg_seconds=round(sum(v) / len(v), 1))
        for stage, v in totals.items()
    ]
    return sorted(timings, key=lambda t: t.avg_seconds, reverse=True)


def collect(ctx: StatsContext) -> PerformanceStats:
    durations = {
        j["job_id"]: seconds
        for j in ctx.jobs
        if j.get("stage") != "failed" and (seconds := job_tracker.generation_seconds(j)) is not None
    }
    if not durations:
        return PerformanceStats()
    values = list(durations.values())
    return PerformanceStats(
        avg_generation_seconds=round(sum(values) / len(values), 1),
        fastest_generation_seconds=min(values),
        sample_size=len(values),
        stages=_stage_averages(ctx, set(durations)),
    )
