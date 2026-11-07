"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import type { BrandGroup, PublishAccountOption } from "./brand-groups";

/** Cuentas por marca en acordeón (cerradas de entrada; marcar el grupo lo despliega), con un
 * contador «2/3» y, debajo de cada cuenta marcada, lo que pase `renderSelected` (p. ej. el formato).
 * `isDisabled` bloquea cuentas (token vencido, ya subiendo) y `renderBadge` les pone un estado. */
export function BrandAccountPicker({
  groups,
  selected,
  onChange,
  renderSelected,
  renderBadge,
  isDisabled,
}: {
  groups: BrandGroup[];
  selected: string[];
  onChange: (selected: string[]) => void;
  renderSelected?: (account: PublishAccountOption) => ReactNode;
  renderBadge?: (account: PublishAccountOption) => ReactNode;
  isDisabled?: (account: PublishAccountOption) => boolean;
}) {
  const usable = (group: BrandGroup) => group.accounts.filter((a) => !isDisabled?.(a));
  const [open, setOpen] = useState<string[]>([]);
  const toggleOpen = (key: string) =>
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleAccount = (selector: string) =>
    onChange(
      selected.includes(selector)
        ? selected.filter((s) => s !== selector)
        : [...selected, selector],
    );
  const toggleGroup = (group: BrandGroup) => {
    const selectors = usable(group).map((a) => a.selector);
    const all = selectors.every((s) => selected.includes(s));
    if (!all) setOpen((prev) => (prev.includes(group.key) ? prev : [...prev, group.key]));
    const next = new Set(selected);
    for (const s of selectors) {
      if (all) next.delete(s);
      else next.add(s);
    }
    onChange([...next]);
  };

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const count = group.accounts.filter((a) => selected.includes(a.selector)).length;
        const selectable = usable(group).length;
        const isOpen = open.includes(group.key);
        return (
          <section key={group.key} className="rounded-2xl border border-nb-line px-2.5 py-1.5">
            <div className="flex items-center gap-2 px-1 py-1 text-[13px] font-bold text-nb-ink">
              <input
                type="checkbox"
                aria-label={group.label}
                checked={selectable > 0 && count === selectable}
                disabled={selectable === 0}
                ref={(el) => {
                  if (el) el.indeterminate = count > 0 && count < selectable;
                }}
                onChange={() => toggleGroup(group)}
                className="size-4 cursor-pointer accent-black"
              />
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleOpen(group.key)}
                className="flex flex-1 cursor-pointer items-center gap-2 text-left"
              >
                <span className="flex-1">{group.label}</span>
                <span className="text-[11px] font-normal text-nb-mute">
                  {count}/{group.accounts.length}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn("size-4 text-nb-mute transition-transform", isOpen && "rotate-180")}
                />
              </button>
            </div>
            {isOpen && (
              <div className="flex flex-col gap-2 pt-1.5 pb-1">
                {group.accounts.map((account) => {
                  const checked = selected.includes(account.selector);
                  const disabled = isDisabled?.(account) ?? false;
                  return (
                    <div key={account.selector} className="rounded-xl border border-nb-line p-2">
                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px]",
                          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                          checked ? "font-semibold text-nb-ink" : "text-nb-ink-soft",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleAccount(account.selector)}
                          className="size-4 accent-black"
                        />
                        <span className="flex-1">{account.label}</span>
                        {renderBadge?.(account)}
                      </label>
                      {checked && renderSelected?.(account)}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
