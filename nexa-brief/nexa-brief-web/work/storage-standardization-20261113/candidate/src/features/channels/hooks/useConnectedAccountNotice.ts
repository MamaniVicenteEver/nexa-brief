import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { PLATFORM_META } from "../constants/platforms";
import type { ChannelPlatform } from "../types";

/** The OAuth success page redirects to `/canales?connected=platform:alias` —
 * confirm it with a toast once, then drop the param so a reload doesn't repeat it. */
export function useConnectedAccountNotice() {
  const t = useTranslations("channels");

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    if (!connected) return;

    const [platform, alias] = connected.split(":");
    const meta = PLATFORM_META[platform as ChannelPlatform];
    if (meta && alias) toast.success(t("connectedToast", { platform: meta.label, alias }));

    url.searchParams.delete("connected");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [t]);
}
