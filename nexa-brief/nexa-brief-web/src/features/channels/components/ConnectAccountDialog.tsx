"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { buildConnectChannelUrl } from "../api/channels-service";
import { ALIAS_PATTERN, PLATFORM_META, PLATFORMS } from "../constants/platforms";
import { nextSuggestedAlias } from "../lib/channels";
import type { ChannelPlatform } from "../types";
import { PlatformIcon } from "./PlatformIcon";
import { dialogContent, fieldInput, primaryButton, secondaryButton } from "./styles";

/** Picks platform + internal alias, then hands the browser to the platform's OAuth consent screen. */
export function ConnectAccountDialog({
  defaultPlatform,
  aliasesByPlatform,
  children,
}: {
  defaultPlatform?: ChannelPlatform;
  aliasesByPlatform: Record<ChannelPlatform, string[]>;
  children: React.ReactNode;
}) {
  const t = useTranslations("channels.connect");
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<ChannelPlatform>(defaultPlatform ?? "youtube");
  const [alias, setAlias] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const existing = aliasesByPlatform[platform] ?? [];
  const suggested = nextSuggestedAlias(platform, existing);
  const value = alias.trim() || suggested;
  const invalid = !ALIAS_PATTERN.test(value);
  const willReplace = !invalid && existing.includes(value);
  const aliasHint =
    platform === "youtube"
      ? t("youtubeAliasHint")
      : platform === "instagram"
        ? t("instagramAliasHint")
        : t("aliasHint");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setPlatform(defaultPlatform ?? "youtube");
      setAlias("");
      setRedirecting(false);
    }
  };

  const handleContinue = () => {
    if (invalid) return;
    setRedirecting(true);
    window.location.href = buildConnectChannelUrl(platform, value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={cn(dialogContent, "gap-5 sm:max-w-[460px]")}>
        <DialogHeader>
          <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-nb-mute">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {!defaultPlatform && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[12.5px] font-semibold text-nb-ink">
              {t("platformLabel")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={platform === p}
                  onClick={() => {
                    setPlatform(p);
                    setAlias("");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-[12.5px] font-semibold text-nb-ink transition-all",
                    platform === p
                      ? "border-nb-ink bg-white/70 shadow-sm"
                      : "border-nb-line hover:border-nb-mute/60 hover:bg-white/40",
                  )}
                >
                  <PlatformIcon platform={p} />
                  {PLATFORM_META[p].label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-nb-ink">{t("aliasLabel")}</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value.toLowerCase())}
            placeholder={suggested}
            aria-invalid={invalid}
            maxLength={32}
            className={fieldInput}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          />
          <span
            className={cn(
              "text-[11.5px]",
              invalid ? "text-red-600" : willReplace ? "text-amber-700" : "text-nb-mute",
            )}
          >
            {invalid
              ? t("aliasInvalid")
              : willReplace
                ? t("aliasExists", { alias: value })
                : aliasHint}
          </span>
        </label>

        <div className="flex gap-3 rounded-2xl bg-nb-bg-2/60 p-3.5 text-[12px] leading-[1.55] text-nb-ink-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-nb-green-dark" />
          <p>{t("securityNote", { platform: PLATFORM_META[platform].label })}</p>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
          <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={invalid || redirecting}
            onClick={handleContinue}
          >
            {redirecting
              ? t("redirecting")
              : t("continue", { platform: PLATFORM_META[platform].label })}
            {!redirecting && <ArrowRight className="size-3.5" />}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
