"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  acceptMediaPlan,
  candidateRef,
  createMediaPlan,
  importStockItem,
} from "../api/studio-service";
import { useMediaPlan } from "../hooks/useMediaPlan";
import type { MediaPlan, MediaRef } from "../types";
import { StockCard } from "./StockSearchPanel";

/** "Que lo elija la IA": con el brief arma una búsqueda por lugar, propone
 * candidatos y, al aceptar, los importa a la librería. Los lugares que el
 * usuario ya llenó se mandan como `locks` y no se buscan. */
export function AiMediaPanel({
  templateId,
  brief,
  onBriefChange,
  filled,
  onAccept,
}: {
  templateId: string;
  brief: string;
  onBriefChange: (brief: string) => void;
  /** Lo ya elegido por lugar: se respeta (lock). */
  filled: Record<string, MediaRef[]>;
  onAccept: (media: Record<string, MediaRef[]>) => void;
}) {
  const t = useTranslations("studio.ai");
  const [planId, setPlanId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: plan } = useMediaPlan(planId);
  const [selection, setSelection] = useState<Record<string, string[]>>({});

  // Al quedar listo, arranca con la selección que propuso la IA.
  useEffect(() => {
    if (plan?.status === "ready") {
      setSelection(Object.fromEntries(plan.slots.map((s) => [s.slot, s.selected])));
    }
  }, [plan?.status, plan?.slots]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const locks = Object.fromEntries(
        Object.entries(filled)
          .filter(([, refs]) => refs.length > 0)
          .map(([slot, refs]) => [slot, refs.map((r) => r.assetId)]),
      );
      const created = await createMediaPlan({
        template_id: templateId,
        brief: brief.trim() || undefined,
        locks,
      });
      setPlanId(created.plan_id);
    } catch {
      setError(t("startError"));
    } finally {
      setStarting(false);
    }
  }

  function toggle(slotName: string, ref: string, max: number) {
    setSelection((prev) => {
      const current = prev[slotName] ?? [];
      if (current.includes(ref)) return { ...prev, [slotName]: current.filter((r) => r !== ref) };
      const next = max <= 1 ? [ref] : [...current, ref].slice(0, max);
      return { ...prev, [slotName]: next };
    });
  }

  async function accept(readyPlan: MediaPlan) {
    setAccepting(true);
    setError(null);
    try {
      const unchanged = readyPlan.slots.every(
        (s) => JSON.stringify(s.selected) === JSON.stringify(selection[s.slot] ?? []),
      );
      const media: Record<string, MediaRef[]> = {};
      if (unchanged) {
        const { template_inputs } = await acceptMediaPlan(readyPlan.plan_id);
        for (const s of readyPlan.slots) {
          if (s.locked) continue;
          const ids = template_inputs.media[s.slot] ?? [];
          if (ids.length) media[s.slot] = ids.map((assetId) => ({ assetId, kind: s.search_kind }));
        }
      } else {
        // Selección cambiada a mano: se importa directo lo elegido (mismo
        // dedupe del backend) en vez de PATCH /media-plans, así no depende de
        // que el CORS del server habilite PATCH.
        for (const s of readyPlan.slots) {
          if (s.locked) continue;
          const refs: MediaRef[] = [];
          for (const ref of selection[s.slot] ?? []) {
            const item = s.candidates.find((c) => candidateRef(c) === ref);
            if (!item) continue;
            const result = await importStockItem(item);
            refs.push({ assetId: result.asset_id, kind: result.kind });
          }
          if (refs.length) media[s.slot] = refs;
        }
      }
      onAccept(media);
      setPlanId(null);
    } catch {
      setError(t("acceptError"));
    } finally {
      setAccepting(false);
    }
  }

  const planning = starting || plan?.status === "planning" || (planId !== null && !plan);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-nb-line bg-nb-bg p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 text-nb-green-dark" />
        <h3 className="text-[13px] font-bold text-nb-ink">{t("title")}</h3>
      </div>
      <textarea
        value={brief}
        onChange={(e) => onBriefChange(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t("briefPlaceholder")}
        aria-label={t("briefLabel")}
        className="resize-none rounded-lg border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
      />
      <button
        type="button"
        onClick={start}
        disabled={planning || accepting}
        className="nb-btn-pill flex items-center justify-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold disabled:opacity-60"
      >
        {planning && <Loader2 className="size-3.5 animate-spin" />}
        {planning
          ? t("planning", { done: plan?.progress.done ?? 0, total: plan?.progress.total ?? 0 })
          : t("start")}
      </button>
      {error && <p className="text-[12px] text-nb-accent-coral">{error}</p>}
      {plan?.status === "failed" && (
        <p className="text-[12px] text-nb-accent-coral">{plan.error ?? t("failed")}</p>
      )}

      {plan?.status === "ready" && (
        <div className="flex flex-col gap-3">
          {plan.slots
            .filter((s) => !s.locked)
            .map((s) => (
              <div key={s.slot} className="flex flex-col gap-1.5">
                <p className="text-[12px] font-semibold text-nb-ink-soft">
                  {s.label || s.slot}
                  {s.query && <span className="ml-1 font-normal text-nb-mute">· “{s.query}”</span>}
                </p>
                {s.candidates.length === 0 ? (
                  <p className="text-[11.5px] text-nb-mute">{t("noCandidates")}</p>
                ) : (
                  <ul className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                    {s.candidates.map((item) => {
                      const ref = candidateRef(item);
                      const isSelected = (selection[s.slot] ?? []).includes(ref);
                      return (
                        <li key={ref}>
                          <StockCard
                            item={item}
                            selected={isSelected}
                            disabled={accepting}
                            actionLabel={isSelected ? t("selected") : t("choose")}
                            onAction={() => toggle(s.slot, ref, s.max)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          <button
            type="button"
            onClick={() => accept(plan)}
            disabled={accepting}
            className="flex items-center justify-center gap-1.5 rounded-full bg-nb-ink px-4 py-2 text-[12.5px] font-semibold text-nb-surface disabled:opacity-60"
          >
            {accepting && <Loader2 className="size-3.5 animate-spin" />}
            {accepting ? t("accepting") : t("accept")}
          </button>
        </div>
      )}
    </div>
  );
}
