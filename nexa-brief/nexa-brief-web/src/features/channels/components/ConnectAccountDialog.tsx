"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  type BrowserSessionStatus,
  buildConnectChannelUrl,
  cancelBrowserSession,
  createTikTokPairing,
  getBrowserSession,
  startTikTokQr,
} from "../api/channels-service";
import { ALIAS_PATTERN, PLATFORM_META, PLATFORMS } from "../constants/platforms";
import { nextSuggestedAlias } from "../lib/channels";
import {
  requestNexaConnect,
  sanitizeTikTokAlias,
  type TikTokBrowserIdentity,
} from "../lib/nexa-connect";
import type { ChannelPlatform } from "../types";
import { PlatformIcon } from "./PlatformIcon";
import { dialogContent, fieldInput, primaryButton, secondaryButton } from "./styles";

type ConnectMethod = "browser" | "qr" | "api";

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
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const [platform, setPlatform] = useState<ChannelPlatform>(defaultPlatform ?? "youtube");
  const [alias, setAlias] = useState(initialAlias ?? "");
  const [redirecting, setRedirecting] = useState(false);
  const [method, setMethod] = useState<ConnectMethod>("browser");
  const [extension, setExtension] = useState<"checking" | "ready" | "missing">("checking");
  const [identity, setIdentity] = useState<TikTokBrowserIdentity | null>(null);
  const [detectError, setDetectError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrAlias, setQrAlias] = useState("");
  const [qrStatus, setQrStatus] = useState<BrowserSessionStatus | null>(null);
  const [qrStarting, setQrStarting] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrStartedAt, setQrStartedAt] = useState<number | null>(null);
  const [qrWaitTimedOut, setQrWaitTimedOut] = useState(false);
  const qrStartGeneration = useRef(0);

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

  const setDialogOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const detectTikTok = useCallback(async () => {
    setExtension("checking");
    setIdentity(null);
    setDetectError("");
    try {
      await requestNexaConnect<{ version: string }>("ping", {}, 1_000);
      setExtension("ready");
      const result = await requestNexaConnect<{
        loggedIn: boolean;
        identity?: TikTokBrowserIdentity;
      }>("tiktok-identity", {}, 8_000);
      if (!result.loggedIn || !result.identity?.username) {
        setIdentity(null);
        return;
      }
      setIdentity(result.identity);
      const detectedAlias = sanitizeTikTokAlias(result.identity.username);
      if (!initialAlias) setAlias((current) => current || detectedAlias);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("browserError");
      if (message.includes("extensión Nexa Connect")) setExtension("missing");
      else {
        setExtension("ready");
        setDetectError(message);
      }
    }
  }, [initialAlias, t]);

  useEffect(() => {
    if (!open) return;
    setPlatform(defaultPlatform ?? "youtube");
    setAlias(initialAlias ?? "");
    setMethod(initialAlias && defaultPlatform === "tiktok" ? "qr" : "browser");
    setRedirecting(false);
    setConnected(false);
    setBrowserError("");
    setQrSessionId(null);
    setQrAlias("");
    setQrStatus(null);
    setQrError(null);
    setQrStartedAt(null);
    setQrWaitTimedOut(false);
  }, [open, defaultPlatform, initialAlias]);

  useEffect(() => {
    if (open && platform === "tiktok" && method === "browser") void detectTikTok();
  }, [open, platform, method, detectTikTok]);

  useEffect(() => {
    if (!open) return;
    return () => {
      // A start response may arrive after this dialog closes or unmounts.
      qrStartGeneration.current += 1;
    };
  }, [open]);

  useEffect(() => {
    if (!qrSessionId || !open) return;
    let timer: number | undefined;
    let active = true;
    let polling = false;
    let consecutiveFailures = 0;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await getBrowserSession(qrSessionId);
        if (!active) return;
        consecutiveFailures = 0;
        setQrError(null);
        setQrStatus(result);
        if (result.qr_png_b64) setQrWaitTimedOut(false);
        if (result.state === "done") {
          void queryClient.invalidateQueries({ queryKey: ["channels"] });
          setConnected(true);
        }
        if (["done", "failed", "expired", "cancelled"].includes(result.state) && timer) {
          window.clearInterval(timer);
        }
      } catch (error) {
        if (active) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) {
            setQrError(error instanceof Error ? error.message : t("qrFailed"));
          }
        }
      } finally {
        polling = false;
      }
    };
    timer = window.setInterval(() => void poll(), 2_000);
    void poll();
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [qrSessionId, open, queryClient, t]);

  useEffect(() => {
    if (
      !qrSessionId ||
      qrStartedAt === null ||
      qrStatus?.qr_png_b64 ||
      ["done", "failed", "expired", "cancelled"].includes(qrStatus?.state ?? "")
    ) {
      return;
    }
    const remaining = Math.max(0, 30_000 - (Date.now() - qrStartedAt));
    const timer = window.setTimeout(() => setQrWaitTimedOut(true), remaining);
    return () => window.clearTimeout(timer);
  }, [qrSessionId, qrStartedAt, qrStatus?.qr_png_b64, qrStatus?.state]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      qrStartGeneration.current += 1;
      setQrStarting(false);
    }
    if (
      !next &&
      qrSessionId &&
      !["done", "failed", "expired", "cancelled"].includes(qrStatus?.state ?? "")
    ) {
      void cancelBrowserSession(qrSessionId).catch(() => setQrError(t("serverRestarting")));
    }
    setDialogOpen(next);
  };

  const handleContinue = () => {
    if (invalid) return;
    setRedirecting(true);
    window.location.href = buildConnectChannelUrl(platform, value);
  };

  const handleBrowserConnect = async () => {
    if (!identity || invalid) return;
    setConnecting(true);
    setBrowserError("");
    try {
      const pairing = await createTikTokPairing(value);
      await requestNexaConnect(
        "tiktok-export",
        {
          importUrl: pairing.import_url,
          expectedUsername: identity.username,
        },
        120_000,
      );
      setConnected(true);
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
    } catch (error) {
      setBrowserError(error instanceof Error ? error.message : t("browserError"));
    } finally {
      setConnecting(false);
    }
  };

  const handleQrStart = async () => {
    const sessionAlias = qrSessionId ? qrAlias : value;
    if (!ALIAS_PATTERN.test(sessionAlias)) return;
    const generation = ++qrStartGeneration.current;
    const previousSessionId = qrSessionId;
    setQrSessionId(null);
    setAlias(sessionAlias);
    setQrStarting(true);
    setQrError(null);
    setQrStatus(null);
    setQrWaitTimedOut(false);
    setQrStartedAt(Date.now());
    if (previousSessionId) {
      try {
        await cancelBrowserSession(previousSessionId);
      } catch {
        // Starting a replacement is still useful when the old in-memory session disappeared.
      }
    }
    try {
      if (generation !== qrStartGeneration.current) return;
      let result: { session_id: string };
      try {
        result = await startTikTokQr(sessionAlias);
      } catch {
        if (generation !== qrStartGeneration.current) return;
        result = await startTikTokQr(sessionAlias);
      }
      if (generation !== qrStartGeneration.current) {
        await cancelBrowserSession(result.session_id);
        return;
      }
      setQrAlias(sessionAlias);
      setQrSessionId(result.session_id);
    } catch {
      if (generation === qrStartGeneration.current) setQrError(t("serverRestarting"));
    } finally {
      if (generation === qrStartGeneration.current) setQrStarting(false);
    }
  };

  const handleQrCancel = async () => {
    if (!qrSessionId) return;
    try {
      await cancelBrowserSession(qrSessionId);
      setQrStatus({ state: "cancelled" });
    } catch (error) {
      setQrError(error instanceof Error ? error.message : t("qrFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={cn(dialogContent, "gap-5 sm:max-w-[520px]")}>
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
          <div className="grid grid-cols-3 gap-1 rounded-full bg-nb-bg-2 p-1">
            {(["browser", "qr", "api"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                className={cn(
                  "rounded-full px-2 py-2 text-[11px] font-semibold leading-tight transition-colors",
                  method === option
                    ? "bg-white text-nb-ink shadow-sm"
                    : "text-nb-mute hover:text-nb-ink",
                )}
              >
                {t(`tiktokMethods.${option}`)}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-nb-ink">{t("aliasLabel")}</span>
          <input
            value={alias}
            disabled={connected || qrStarting || Boolean(qrSessionId)}
            onChange={(event) => setAlias(event.target.value.toLowerCase())}
            placeholder={suggested}
            aria-invalid={invalid}
            maxLength={32}
            className={fieldInput}
            onKeyDown={(event) => event.key === "Enter" && method === "api" && handleContinue()}
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

        {platform === "tiktok" && method === "browser" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-white/45 p-4">
            <div className="rounded-lg bg-nb-bg-2/60 px-3 py-3 text-[11.5px] leading-relaxed text-nb-ink-soft">
              <ol className="list-decimal space-y-1.5 pl-4 text-left">
                <li>
                  {t.rich("browserGuideStep1", {
                    strong: (chunks) => (
                      <strong className="font-semibold text-nb-ink">{chunks}</strong>
                    ),
                  })}
                </li>
                <li>
                  {t.rich("browserGuideStep2", {
                    strong: (chunks) => (
                      <strong className="font-semibold text-nb-ink">{chunks}</strong>
                    ),
                  })}
                </li>
                <li>
                  {t.rich("browserGuideStep3", {
                    strong: (chunks) => (
                      <strong className="font-semibold text-nb-ink">{chunks}</strong>
                    ),
                    em: (chunks) => <em>{chunks}</em>,
                  })}
                </li>
              </ol>
            </div>
            {extension === "checking" && (
              <p className="text-[12.5px] text-nb-mute">{t("extensionChecking")}</p>
            )}
            {extension === "missing" && (
              <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-nb-ink-soft">
                <p>{t("extensionMissing")}</p>
                <a
                  className="font-semibold text-nb-ink underline"
                  href="/downloads/nexa-connect.zip"
                  download
                >
                  {t("installExtension")}
                </a>
              </div>
            )}
            {extension === "ready" && (
              <>
                <p className="text-[12px] font-semibold text-nb-green-dark">
                  {t("extensionDetected")}
                </p>
                {identity ? (
                  <div className="flex items-center gap-3 rounded-xl bg-nb-bg-2/70 p-3">
                    {identity.avatarUrl ? (
                      // biome-ignore lint/performance/noImgElement: TikTok account avatar
                      <img
                        src={identity.avatarUrl}
                        alt=""
                        className="size-11 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-full bg-white text-lg font-bold text-nb-ink">
                        {(identity.nickname || identity.username).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-nb-mute">{t("accountOpen")}</p>
                      <p className="truncate text-[14px] font-bold text-nb-ink">
                        @{identity.username}
                      </p>
                      {identity.nickname && identity.nickname !== identity.username && (
                        <p className="truncate text-[11px] text-nb-mute">{identity.nickname}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 text-[12.5px] text-nb-ink-soft">
                    <p>{t("noTikTokSession")}</p>
                    <a
                      href="https://www.tiktok.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit font-semibold underline"
                    >
                      {t("openTikTok")}
                    </a>
                  </div>
                )}
                {detectError && (
                  <p role="alert" className="text-[12px] text-red-700">
                    {detectError}
                  </p>
                )}
                {identity && (
                  <p className="text-[11.5px] leading-relaxed text-nb-mute">
                    {t("multipleAccountsTip")}
                  </p>
                )}
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
                  {t("sharedSessionWarning")}
                </p>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => void detectTikTok()}
                >
                  {t("detectAgain")}
                </button>
              </>
            )}
            {browserError && (
              <p role="alert" className="text-[12px] text-red-700">
                {browserError}
              </p>
            )}
            {connected && (
              <p
                role="status"
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-nb-green-dark"
              >
                <Check className="size-4" />
                {t("connectedBrowser")}
              </p>
            )}
          </div>
        )}

        {platform === "tiktok" && method === "qr" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-nb-line bg-white/45 p-4 text-center">
            <div className="w-full rounded-lg bg-nb-bg-2/60 px-3 py-3 text-[11.5px] leading-relaxed text-nb-ink-soft">
              <ol className="list-decimal space-y-1.5 pl-4 text-left">
                <li>{t("qrGuideStep1")}</li>
                <li>
                  {t.rich("qrGuideStep2", {
                    strong: (chunks) => (
                      <strong className="font-semibold text-nb-ink">{chunks}</strong>
                    ),
                  })}
                </li>
                <li>
                  {t.rich("qrGuideStep3", {
                    strong: (chunks) => (
                      <strong className="font-semibold text-nb-ink">{chunks}</strong>
                    ),
                  })}
                </li>
                <li>{t("qrGuideStep4")}</li>
              </ol>
              <p className="mt-2 text-nb-mute">{t("qrRouteNote")}</p>
            </div>
            {!qrStatus?.qr_png_b64 ? (
              <>
                <p className="rounded-lg bg-white px-3 py-2 text-[14px] font-bold leading-relaxed text-nb-ink shadow-sm">
                  {t("qrAppRoute")}
                </p>
                <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">
                  {qrWaitTimedOut ? t("qrNoCodeWarning") : t("qrPreparing")}
                </p>
              </>
            ) : (
              <>
                <p className="rounded-lg bg-white px-3 py-2 text-[14px] font-bold leading-relaxed text-nb-ink shadow-sm">
                  {t("qrAppRoute")}
                </p>
                <Image
                  src={`data:image/png;base64,${qrStatus.qr_png_b64}`}
                  alt={t("qrScanHint")}
                  width={224}
                  height={224}
                  unoptimized
                  className="size-56 rounded-lg border border-nb-line bg-white object-contain"
                />
              </>
            )}
            {qrSessionId &&
              !["starting", "failed", "expired"].includes(qrStatus?.state ?? "") &&
              (!qrWaitTimedOut || qrStatus?.state === "queued") && (
                <p role="status" className="text-[12.5px] text-nb-ink-soft">
                  {qrStatus?.state === "scanned"
                    ? t("qrScanned")
                    : qrStatus?.state === "logged_in"
                      ? t("qrLoggedIn")
                      : qrStatus?.state === "done"
                        ? t("connectedBrowser")
                        : qrStatus?.state === "cancelled"
                          ? t("qrCancelled")
                          : qrStatus?.state === "queued"
                            ? t("qrQueued")
                            : qrStatus?.qr_png_b64
                              ? t("qrWaiting")
                              : t("qrPreparing")}
                </p>
              )}
            {qrStatus?.identity?.username && (
              <p className="text-[13px] font-bold text-nb-ink">@{qrStatus.identity.username}</p>
            )}
            {(qrError || qrStatus?.state === "failed" || qrStatus?.state === "expired") && (
              <p role="alert" className="text-[12px] text-red-700">
                {qrStatus?.state === "failed" || qrStatus?.state === "expired"
                  ? qrStatus.error || t("qrFailed")
                  : qrError}
              </p>
            )}
            {connected && (
              <p className="flex items-center gap-1 text-[12px] font-semibold text-nb-green-dark">
                <Check className="size-4" />
                {t("connectedBrowser")}
              </p>
            )}
          </div>
        )}

        {platform === "tiktok" && method === "api" && (
          <div className="flex gap-3 rounded-2xl bg-amber-500/10 p-3.5 text-[12px] leading-[1.55] text-amber-900">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>{t("apiPrivateNote")}</p>
          </div>
        )}

        {!(platform === "tiktok" && method !== "api") && (
          <div className="flex gap-3 rounded-2xl bg-nb-bg-2/60 p-3.5 text-[12px] leading-[1.55] text-nb-ink-soft">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-nb-green-dark" />
            <p>{t("securityNote", { platform: PLATFORM_META[platform].label })}</p>
          </div>
        )}

        <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
          <button
            type="button"
            className={connected || qrStatus?.state === "done" ? primaryButton : secondaryButton}
            onClick={() => handleOpenChange(false)}
          >
            {connected || qrStatus?.state === "done" ? t("close") : t("cancel")}
          </button>
          {platform === "tiktok" &&
            method === "browser" &&
            extension === "ready" &&
            identity &&
            !connected && (
              <button
                type="button"
                className={primaryButton}
                disabled={invalid || connecting}
                onClick={() => void handleBrowserConnect()}
              >
                {connecting ? t("connectingBrowser") : t("connectBrowser")}
                {!connecting && <ArrowRight className="size-3.5" />}
              </button>
            )}
          {platform === "tiktok" && method === "qr" && !connected && (
            <>
              {qrSessionId &&
                !["done", "failed", "expired", "cancelled"].includes(qrStatus?.state ?? "") && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => void handleQrCancel()}
                  >
                    {t("qrCancel")}
                  </button>
                )}
              {!qrSessionId ||
              ["failed", "expired", "cancelled"].includes(qrStatus?.state ?? "") ||
              qrWaitTimedOut ? (
                <button
                  type="button"
                  className={primaryButton}
                  disabled={(!qrSessionId && invalid) || qrStarting}
                  onClick={() => void handleQrStart()}
                >
                  {qrStarting
                    ? t("qrStarting")
                    : qrSessionId
                      ? t("qrGenerateAnother")
                      : t("qrStart")}
                </button>
              ) : null}
            </>
          )}
          {platform === "tiktok" && method === "api" && (
            <button
              type="button"
              className={primaryButton}
              disabled={invalid || redirecting}
              onClick={handleContinue}
            >
              {redirecting ? t("redirecting") : t("apiOfficial")}
              {!redirecting && <ArrowRight className="size-3.5" />}
            </button>
          )}
          {platform !== "tiktok" && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
