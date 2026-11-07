import type { CategoryNode } from "@/features/categories";
import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import type { ChannelAccount, ChannelPlatform } from "../types";
import { accountKey, matchesQuery } from "./channels";

export const UNASSIGNED_CATEGORY = "__unassigned";
export type ChannelCategory = Pick<CategoryNode, "id" | "path" | "displayName">;
export interface CategoryMembership {
  categoryId: string;
  platform: ChannelPlatform;
  alias: string;
}
export interface CategoryAccountIdentity {
  platform: ChannelPlatform;
  targetId: string;
}
export interface ManagedChannelCategory {
  id: string;
  displayName: string;
  members: CategoryAccountIdentity[];
}

export function categoryAccountKey(account: CategoryAccountIdentity): string {
  return JSON.stringify([account.platform, account.targetId]);
}

export function mergeChannelCategories(
  base: ChannelCategory[],
  managed: ManagedChannelCategory[],
): ChannelCategory[] {
  const known = new Set(base.map((category) => category.id));
  return [
    ...base,
    ...managed
      .filter((category) => !known.has(category.id))
      .map((category) => ({
        id: category.id,
        path: category.id,
        displayName: category.displayName,
      })),
  ];
}
export interface ChannelCategoryGroup {
  id: string;
  name: string;
  accounts: ChannelAccount[];
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Explicit publication mappings take precedence over public-name matches.
 * Never infer membership from internal aliases such as pagina_3 or nodatech. */
export function groupChannelsByCategory(
  accounts: ChannelAccount[],
  categories: ChannelCategory[],
  memberships: CategoryMembership[],
  unassignedLabel: string,
  managed: ManagedChannelCategory[] = [],
): ChannelCategoryGroup[] {
  const groups = categories.map((c) => ({
    id: c.id,
    name: c.displayName,
    accounts: [] as ChannelAccount[],
  }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const managedIds = new Set(managed.map((category) => category.id));
  const manual = new Map<string, Set<string>>();
  for (const category of managed) {
    if (!byId.has(category.id)) continue;
    for (const member of category.members) {
      const key = categoryAccountKey(member);
      const ids = manual.get(key) ?? new Set<string>();
      ids.add(category.id);
      manual.set(key, ids);
    }
  }
  const explicit = new Map<string, Set<string>>();
  for (const link of memberships) {
    if (!byId.has(link.categoryId) || managedIds.has(link.categoryId)) continue;
    const key = accountKey(link);
    const linked = explicit.get(key) ?? new Set<string>();
    linked.add(link.categoryId);
    explicit.set(key, linked);
  }
  const identities = new Map(
    categories.map((c) => [c.id, new Set([c.id, c.path, c.displayName].map(normalize))]),
  );
  // Linked profiles also supply spelling variants, e.g. NodeEconomy / Nodeconomy.
  for (const account of accounts) {
    for (const id of explicit.get(accountKey(account)) ?? []) {
      if (account.name.trim()) identities.get(id)?.add(normalize(account.name));
    }
  }
  const unassigned: ChannelCategoryGroup = {
    id: UNASSIGNED_CATEGORY,
    name: unassignedLabel,
    accounts: [],
  };
  for (const account of accounts) {
    let ids = [...(explicit.get(accountKey(account)) ?? [])];
    if (!ids.length) {
      for (const name of [account.name, account.handle, account.linkedPageName]) {
        if (!name?.trim()) continue;
        const matches = categories.filter(
          (c) => !managedIds.has(c.id) && identities.get(c.id)?.has(normalize(name)),
        );
        if (matches.length === 1) ids = [matches[0].id];
        if (matches.length) break; // Ambiguous public names remain unassigned.
      }
    }
    ids = [...new Set([...ids, ...(manual.get(categoryAccountKey(account)) ?? [])])];
    if (!ids.length) unassigned.accounts.push(account);
    else for (const id of ids) byId.get(id)?.accounts.push(account);
  }
  if (unassigned.accounts.length) groups.push(unassigned);
  for (const group of groups) {
    group.accounts.sort(
      (a, b) =>
        PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform) ||
        Number(b.status === "requires_reauth") - Number(a.status === "requires_reauth") ||
        a.alias.localeCompare(b.alias, undefined, { numeric: true }),
    );
  }
  return groups;
}

export function filterCategoryGroups(
  groups: ChannelCategoryGroup[],
  query: string,
  platform: ChannelPlatform | "all",
): ChannelCategoryGroup[] {
  const q = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      accounts: group.accounts.filter(
        (account) =>
          (platform === "all" || account.platform === platform) &&
          (!q ||
            (normalize(q).length > 0 && normalize(group.name).includes(normalize(q))) ||
            PLATFORM_META[account.platform].label.toLowerCase().includes(q) ||
            matchesQuery(account, query)),
      ),
    }))
    .filter((group) => (!q && platform === "all") || group.accounts.length > 0);
}
