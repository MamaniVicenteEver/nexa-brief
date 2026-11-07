/** Cuentas de publicación agrupadas por marca (NODEMOTION, NODETECH…), igual en todos los paneles.
 *
 * Una marca es un grupo con canal de YouTube: su nombre es el del canal. El resto de las cuentas
 * (páginas o perfiles sin canal de YouTube) va junto en «Otros», al final. Los nombres se comparan
 * sin mayúsculas, tildes, signos ni letras repetidas (NODECONOMY = NodeEconomy = Nodeconomy). */

export type PublishFormat = "16x9" | "9x16";

export interface PublishAccountOption {
  /** "platform:alias" */
  selector: string;
  /** "youtube · NODETECH" */
  label: string;
  platform: string;
  /** Nombre con el que se agrupa (el de la cuenta). */
  group: string;
}

export interface BrandGroup {
  key: string;
  label: string;
  accounts: PublishAccountOption[];
}

export const OTHERS_GROUP_KEY = "__others";
export const PUBLISHABLE_PLATFORMS = ["youtube", "tiktok", "facebook", "instagram"];

export function brandKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** Cuentas tal como llegan de GET /publish/accounts → opciones del selector. */
export function toAccountOptions(
  accounts: { platform: string; alias: string; name?: string | null; label?: string | null }[],
): PublishAccountOption[] {
  return accounts
    .filter((account) => PUBLISHABLE_PLATFORMS.includes(account.platform))
    .map((account) => ({
      selector: `${account.platform}:${account.alias}`,
      label: `${account.platform} · ${account.name || account.alias}`,
      platform: account.platform,
      group: account.name?.trim() || account.label?.trim() || account.alias,
    }));
}

export function groupAccountsByBrand(
  accounts: PublishAccountOption[],
  othersLabel: string,
): BrandGroup[] {
  const grouped = new Map<string, BrandGroup>();
  for (const account of accounts) {
    const key = brandKey(account.group);
    const group = grouped.get(key) ?? { key, label: account.group, accounts: [] };
    if (account.platform === "youtube") group.label = account.group;
    group.accounts.push(account);
    grouped.set(key, group);
  }
  const hasYoutube = (group: BrandGroup) => group.accounts.some((a) => a.platform === "youtube");
  const brands = [...grouped.values()].filter(hasYoutube);
  const others = [...grouped.values()]
    .filter((group) => !hasYoutube(group))
    .flatMap((g) => g.accounts);
  return others.length
    ? [...brands, { key: OTHERS_GROUP_KEY, label: othersLabel, accounts: others }]
    : brands;
}

/** Formatos que puede usar una cuenta: los grabados, y YouTube solo en 16:9. */
export function allowedFormatsFor(platform: string, recorded: PublishFormat[]): PublishFormat[] {
  return platform === "youtube" ? recorded.filter((f) => f === "16x9") : recorded;
}

const DEFAULT_FORMAT: Record<string, PublishFormat> = {
  youtube: "16x9",
  facebook: "16x9",
  instagram: "9x16",
  tiktok: "9x16",
};

/** El formato elegido para una cuenta, o el de su red si no eligió (siempre uno de los permitidos). */
export function formatFor(
  account: PublishAccountOption,
  recorded: PublishFormat[],
  chosen: Record<string, PublishFormat>,
): PublishFormat | null {
  const allowed = allowedFormatsFor(account.platform, recorded);
  const wanted = chosen[account.selector] ?? DEFAULT_FORMAT[account.platform] ?? "16x9";
  return allowed.includes(wanted) ? wanted : (allowed[0] ?? null);
}
