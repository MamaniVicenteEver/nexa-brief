"use client";
import { ArrowRight, BarChart3, Film, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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

export function ConnectAccountDialog({
  defaultPlatform,
  aliasesByPlatform,
  children,
  initialAlias,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultPlatform?: ChannelPlatform;
  aliasesByPlatform: Record<ChannelPlatform, string[]>;
  children: React.ReactNode;
  initialAlias?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("channels.connect");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const [platform, setPlatform] = useState<ChannelPlatform>(defaultPlatform ?? "youtube");
  const [alias, setAlias] = useState(initialAlias ?? "");
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (open) {
      setPlatform(defaultPlatform ?? "youtube");
      setAlias(initialAlias ?? "");
      setRedirecting(false);
    }
  }, [open, defaultPlatform, initialAlias]);
  const existing = aliasesByPlatform[platform] ?? [];
  const suggested = nextSuggestedAlias(platform, existing);
  const value = platform === "tiktok" ? initialAlias || suggested : alias.trim() || suggested;
  const invalid = !ALIAS_PATTERN.test(value);
  const willReplace = !invalid && existing.includes(value);
  const aliasHint =
    platform === "youtube"
      ? t("youtubeAliasHint")
      : platform === "instagram"
        ? t("instagramAliasHint")
        : t("aliasHint");
  const setDialogOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const handleContinue = () => {
    if (!invalid) {
      setRedirecting(true);
      window.location.href = buildConnectChannelUrl(platform, value);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          dialogContent,
          "max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-[520px]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
            {platform === "tiktok" ? t("tiktokTitle") : t("title")}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-nb-mute">
            {platform === "tiktok" ? t("tiktokDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>
        {!defaultPlatform && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[12.5px] font-semibold text-nb-ink">
              {t("platformLabel")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={platform === item}
                  onClick={() => {
                    setPlatform(item);
                    setAlias(initialAlias ?? "");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-[12.5px] font-semibold text-nb-ink transition-all",
                    platform === item
                      ? "border-nb-ink bg-white/70 shadow-sm"
                      : "border-nb-line hover:border-nb-mute/60 hover:bg-white/40",
                  )}
                >
                  <PlatformIcon platform={item} />
                  {PLATFORM_META[item].label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {platform === "tiktok" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-nb-line bg-white/55 p-4">
              <PlatformIcon platform="tiktok" className="size-11" rounded="rounded-xl" />
              <div>
                <p className="text-[14px] font-bold text-nb-ink">{t("tiktokAccountTitle")}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-nb-mute">
                  {t("tiktokAccountHint")}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2.5 text-[11px] font-bold tracking-[0.08em] text-nb-mute uppercase">
                {t("tiktokAccessTitle")}
              </p>
              <div className="space-y-3 rounded-2xl border border-nb-line bg-white/35 p-4">
                {(
                  [
                    [UserRound, "tiktokProfileTitle", "tiktokProfileDetail"],
                    [Film, "tiktokVideosTitle", "tiktokVideosDetail"],
                    [BarChart3, "tiktokStatsTitle", "tiktokStatsDetail"],
                  ] as const
                ).map(([Icon, title, detail]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-nb-bg-2 text-nb-ink-soft">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-nb-ink">{t(title)}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-nb-mute">{t(detail)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-nb-ink-soft">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-nb-green-dark"
                aria-hidden="true"
              />
              {t("tiktokConsent")}
            </p>
          </div>
        )}

        {platform !== "tiktok" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-nb-ink">{t("aliasLabel")}</span>
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value.toLowerCase())}
              placeholder={suggested}
              aria-invalid={invalid}
              maxLength={32}
              className={fieldInput}
              onKeyDown={(event) => event.key === "Enter" && handleContinue()}
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
        )}

        {platform !== "tiktok" && (
          <div className="flex gap-3 rounded-2xl bg-nb-bg-2/60 p-3.5 text-[12px] leading-[1.55] text-nb-ink-soft">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-nb-green-dark" />
            <p>{t("securityNote", { platform: PLATFORM_META[platform].label })}</p>
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
          <button type="button" className={secondaryButton} onClick={() => setDialogOpen(false)}>
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
              : platform === "tiktok"
                ? t("tiktokConnect")
                : t("continue", { platform: PLATFORM_META[platform].label })}
            {!redirecting && <ArrowRight className="size-3.5" />}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
