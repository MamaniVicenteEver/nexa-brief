import { useTranslations } from "next-intl";
import { getExpiryState } from "../lib/channels";

export function useExpiryLabel() {
  const t = useTranslations("channels.expiry");
  return (account: { expiresInSeconds: number | null; hasRefreshToken: boolean }): string => {
    const state = getExpiryState(account.expiresInSeconds, account.hasRefreshToken);
    return "value" in state ? t(state.kind, { value: state.value }) : t(state.kind);
  };
}
