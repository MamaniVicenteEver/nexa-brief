"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { flattenCategories, useCategories } from "@/features/categories";
import { type ProductionState, ProductionStateBadge } from "@/features/explainer";
import { cn } from "@/lib/utils";
import {
  useDeletePlanItemMutation,
  usePlanItems,
  usePlannerChatMutation,
  useProducePlanItemMutation,
  useSavePlanMutation,
} from "../hooks/usePlanner";
import type { PlanItem, PlannerMessage, PlannerProvider } from "../types";

const PROVIDERS: PlannerProvider[] = ["deepseek", "claude", "codex"];
const FIELD_CLASS =
  "rounded-xl border border-nb-line bg-transparent px-3 py-1.5 text-[13px] text-nb-ink outline-none focus:border-nb-ink";
const TH_CLASS = "px-2 py-2 text-left text-[11px] font-semibold text-nb-mute uppercase";
const TD_CLASS = "px-2 py-2 align-top text-[12.5px] text-nb-ink-soft";

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Próximo lunes (si hoy es lunes, el de la semana que viene), como hace el backend. */
function nextMonday(): string {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7; // 0 = lunes
  date.setDate(date.getDate() + ((7 - weekday) % 7 || 7));
  return toIsoDate(date);
}

/** Etiquetas y motor por path de categoría (para la tabla y el botón "Producir"). */
function useCategoryLookup() {
  const { data: tree = [] } = useCategories();
  const labels = new Map(flattenCategories(tree).map((c) => [c.path, c.label]));
  const engines = new Map(tree.map((c) => [c.id, c.engine]));
  return {
    label: (path: string) => labels.get(path) ?? path,
    isExplainer: (path: string) => engines.get(path.split("/")[0]) === "explainer_kit",
  };
}

interface ChatEntry extends PlannerMessage {
  id: number;
}

interface Proposal {
  id: number;
  item: PlanItem;
  checked: boolean;
}

function SavedPlan() {
  const t = useTranslations("schedule");
  const [fromDate] = useState(() => toIsoDate(new Date()));
  const { data: items = [], isLoading } = usePlanItems(fromDate);
  const produce = useProducePlanItemMutation();
  const remove = useDeletePlanItemMutation();
  const lookup = useCategoryLookup();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[14px] font-bold text-nb-ink">{t("planner.savedHeading")}</h3>
      {isLoading && <p className="text-[12.5px] text-nb-mute">{t("planner.loadingSaved")}</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-[12.5px] text-nb-mute">{t("planner.savedEmpty")}</p>
      )}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-nb-line">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-nb-line">
              <tr>
                <th className={TH_CLASS}>{t("planner.colDate")}</th>
                <th className={TH_CLASS}>{t("planner.colCategory")}</th>
                <th className={TH_CLASS}>{t("planner.colDesign")}</th>
                <th className={TH_CLASS}>{t("planner.colTopic")}</th>
                <th className={TH_CLASS}>{t("planner.colProduction")}</th>
                <th className={TH_CLASS}>
                  <span className="sr-only">{t("planner.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const explainer = lookup.isExplainer(item.categoryPath);
                const producing = produce.isPending && produce.variables?.itemId === item.itemId;
                return (
                  <tr key={item.itemId} className="border-b border-nb-line last:border-0">
                    <td className={cn(TD_CLASS, "whitespace-nowrap")}>
                      {item.date} · {item.time}
                    </td>
                    <td className={TD_CLASS}>{lookup.label(item.categoryPath)}</td>
                    <td className={TD_CLASS}>{item.design ?? "—"}</td>
                    <td className={TD_CLASS}>
                      <p className="font-semibold text-nb-ink">{item.topic}</p>
                      {item.angle && <p className="text-[11.5px] text-nb-mute">{item.angle}</p>}
                    </td>
                    <td className={TD_CLASS}>
                      {item.productionState ? (
                        <ProductionStateBadge state={item.productionState as ProductionState} />
                      ) : explainer ? (
                        <span className="text-nb-mute">{t("planner.notProduced")}</span>
                      ) : (
                        <span className="text-nb-mute">{t("planner.informational")}</span>
                      )}
                    </td>
                    <td className={cn(TD_CLASS, "whitespace-nowrap text-right")}>
                      {explainer && !item.productionId && (
                        <button
                          type="button"
                          disabled={producing}
                          onClick={() =>
                            produce.mutate(
                              { itemId: item.itemId },
                              { onSuccess: () => toast.success(t("planner.produceStarted")) },
                            )
                          }
                          className="mr-2 rounded-full border border-nb-ink px-3 py-1 text-[11.5px] font-semibold text-nb-ink disabled:opacity-50"
                        >
                          {producing ? t("planner.producing") : t("planner.produce")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={remove.isPending && remove.variables === item.itemId}
                        onClick={() => remove.mutate(item.itemId)}
                        className="text-[11.5px] font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {t("slots.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** "Planificador con IA": conversa con la IA y guarda el plan de la semana. */
export function PlannerSection() {
  const t = useTranslations("schedule");
  const chat = usePlannerChatMutation();
  const savePlan = useSavePlanMutation();
  const lookup = useCategoryLookup();
  const nextId = useRef(0);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<PlannerProvider>("deepseek");
  const [weekStart, setWeekStart] = useState(nextMonday);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const send = () => {
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const history = [...messages, { id: nextId.current++, role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    chat.mutate(
      {
        messages: history.map(({ role, content: text }) => ({ role, content: text })),
        weekStart,
        provider,
      },
      {
        onSuccess: (reply) => {
          setMessages((current) => [
            ...current,
            { id: nextId.current++, role: "assistant", content: reply.reply },
          ]);
          setWarnings(reply.warnings);
          if (reply.items.length > 0) {
            setProposals(
              reply.items.map((item) => ({ id: nextId.current++, item, checked: true })),
            );
          }
        },
      },
    );
  };

  const checked = proposals.filter((p) => p.checked);
  const allChecked = proposals.length > 0 && checked.length === proposals.length;

  const handleSave = () => {
    if (checked.length === 0) return;
    savePlan.mutate(
      checked.map((p) => p.item),
      {
        onSuccess: (saved) => {
          toast.success(t("planner.saved", { count: saved.length }));
          setProposals((current) => current.filter((p) => !p.checked));
        },
      },
    );
  };

  return (
    <section aria-labelledby="planner-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="planner-heading"
            className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink"
          >
            {t("planner.heading")}
          </h2>
          <p className="text-[12.5px] text-nb-mute">{t("planner.description")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("planner.provider")}
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as PlannerProvider)}
              className={FIELD_CLASS}
            >
              {PROVIDERS.map((name) => (
                <option key={name} value={name}>
                  {t(`planner.providers.${name}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("planner.weekStart")}
            </span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-nb-surface p-4">
        <div className="flex max-h-[360px] min-h-[120px] flex-col gap-2 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-[12.5px] text-nb-mute">{t("planner.emptyChat")}</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] whitespace-pre-wrap",
                message.role === "user"
                  ? "self-end bg-nb-ink text-[#fafaf7]"
                  : "self-start border border-nb-line bg-white/60 text-nb-ink",
              )}
            >
              {message.content}
            </div>
          ))}
          {chat.isPending && (
            <p className="self-start text-[12px] text-nb-mute">{t("planner.thinking")}</p>
          )}
          {chat.isError && (
            <p className="self-start text-[12px] text-red-600">{chat.error.message}</p>
          )}
        </div>
        <div className="flex items-end gap-2 border-t border-nb-line pt-3">
          <textarea
            rows={2}
            value={draft}
            aria-label={t("planner.messageLabel")}
            placeholder={t("planner.placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            className={cn(FIELD_CLASS, "flex-1 resize-y")}
          />
          <button
            type="button"
            disabled={!draft.trim() || chat.isPending}
            onClick={send}
            className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          >
            {chat.isPending ? t("planner.sending") : t("planner.send")}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="rounded-2xl border border-nb-accent-amber/40 bg-nb-accent-gold/10 px-4 py-3 text-[12.5px] text-nb-ink-soft">
          {warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      {proposals.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-bold text-nb-ink">{t("planner.proposalHeading")}</h3>
            <button
              type="button"
              disabled={checked.length === 0 || savePlan.isPending}
              onClick={handleSave}
              className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            >
              {savePlan.isPending
                ? t("common.saving")
                : t("planner.savePlan", { count: checked.length })}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-nb-line">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-nb-line">
                <tr>
                  <th className={TH_CLASS}>
                    <input
                      type="checkbox"
                      aria-label={t("planner.selectAll")}
                      checked={allChecked}
                      onChange={() =>
                        setProposals((current) =>
                          current.map((p) => ({ ...p, checked: !allChecked })),
                        )
                      }
                    />
                  </th>
                  <th className={TH_CLASS}>{t("planner.colDate")}</th>
                  <th className={TH_CLASS}>{t("planner.colCategory")}</th>
                  <th className={TH_CLASS}>{t("planner.colDesign")}</th>
                  <th className={TH_CLASS}>{t("planner.colTopic")}</th>
                  <th className={TH_CLASS}>{t("planner.colAngle")}</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal) => (
                  <tr key={proposal.id} className="border-b border-nb-line last:border-0">
                    <td className={TD_CLASS}>
                      <input
                        type="checkbox"
                        aria-label={proposal.item.topic}
                        checked={proposal.checked}
                        onChange={() =>
                          setProposals((current) =>
                            current.map((p) =>
                              p.id === proposal.id ? { ...p, checked: !p.checked } : p,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className={cn(TD_CLASS, "whitespace-nowrap")}>
                      {proposal.item.date} · {proposal.item.time}
                    </td>
                    <td className={TD_CLASS}>{lookup.label(proposal.item.categoryPath)}</td>
                    <td className={TD_CLASS}>{proposal.item.design ?? "—"}</td>
                    <td className={cn(TD_CLASS, "font-semibold text-nb-ink")}>
                      {proposal.item.topic}
                    </td>
                    <td className={TD_CLASS}>{proposal.item.angle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SavedPlan />
    </section>
  );
}
