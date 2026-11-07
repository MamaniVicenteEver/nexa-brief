import { describe, expect, it } from "vitest";
import {
  type CategoryMembership,
  filterCategoryGroups,
  groupChannelsByCategory,
  mergeChannelCategories,
  UNASSIGNED_CATEGORY,
} from "../lib/category-groups";
import type { ChannelAccount } from "../types";

const categories = [
  { id: "node_tech", path: "node_tech", displayName: "NodeTech" },
  { id: "node_economy", path: "node_economy", displayName: "NodeEconomy" },
  { id: "node_motion", path: "node_motion", displayName: "NodeMotion" },
];
const account = (fields: Partial<ChannelAccount>): ChannelAccount => ({
  platform: "youtube",
  alias: "canal_1",
  name: "NODETECH",
  targetId: "",
  status: "ok",
  mode: "api",
  lastSessionCheck: null,
  expiresInSeconds: null,
  hasRefreshToken: true,
  avatar: null,
  handle: null,
  description: "",
  customUrl: null,
  profileSyncedAt: null,
  linkedPageName: null,
  linkedPageId: null,
  publishedCount: 0,
  stats: null,
  syncedAt: null,
  canSync: true,
  label: "",
  notes: "",
  connectedAt: null,
  lastPublishedAt: null,
  ...fields,
});
const group = (rows: ChannelAccount[], links: CategoryMembership[] = []) =>
  groupChannelsByCategory(rows, categories, links, "Sin categoría");

describe("channels grouped by category", () => {
  it("combines social networks by public name, preserving the configured category order", () => {
    const rows = [
      account({ platform: "instagram", alias: "ig_1", name: "NodeTech" }),
      account({ platform: "youtube", name: "NODETECH" }),
      account({ platform: "facebook", alias: "pagina_3", name: "Node Tech" }),
      account({ platform: "tiktok", alias: "cuenta_2", name: "nodetech" }),
    ];
    const result = group(rows);
    expect(result.map((g) => g.id)).toEqual(categories.map((c) => c.id));
    expect(result[0].accounts.map((a) => a.platform)).toEqual([
      "youtube",
      "tiktok",
      "facebook",
      "instagram",
    ]);
    expect(rows[0].platform).toBe("instagram");
  });
  it("prefers explicit mappings to the account name and never uses internal aliases to guess", () => {
    const rows = [
      account({ platform: "facebook", alias: "nodetech", name: "NodeEconomy" }),
      account({ platform: "tiktok", alias: "nodetech", name: "Pruebas" }),
    ];
    const result = group(rows, [
      { categoryId: "node_motion", platform: "facebook", alias: "nodetech" },
    ]);
    expect(result.find((g) => g.id === "node_motion")?.accounts).toEqual([rows[0]]);
    expect(result.find((g) => g.id === UNASSIGNED_CATEGORY)?.accounts).toEqual([rows[1]]);
  });
  it("learns Nodeconomy spelling from an explicitly linked public profile", () => {
    const rows = [
      account({ platform: "instagram", alias: "nodatech", name: "Nodeconomy" }),
      account({ name: "NODECONOMY" }),
    ];
    expect(
      group(rows, [{ categoryId: "node_economy", platform: "instagram", alias: "nodatech" }])[1]
        .accounts,
    ).toHaveLength(2);
  });
  it("leaves unknown brands visible and does not merge similar names", () => {
    const rows = [
      account({ name: "NodeAtlas" }),
      account({ alias: "canal_2", name: "NodeTech Noticias" }),
      account({ alias: "canal_3", name: "", handle: "@nodetech" }),
    ];
    const result = group(rows);
    expect(result[0].accounts).toEqual([rows[2]]);
    expect(result.find((g) => g.id === UNASSIGNED_CATEGORY)?.accounts).toEqual(rows.slice(0, 2));
  });
  it("deduplicates explicit links while allowing an account deliberately linked to two categories", () => {
    const row = account({ name: "Compartida" });
    const link = { categoryId: "node_tech", platform: "youtube" as const, alias: "canal_1" };
    const result = group(
      [row],
      [link, link, { ...link, categoryId: "node_motion" }, { ...link, categoryId: "deleted" }],
    );
    expect(result[0].accounts).toEqual([row]);
    expect(result[2].accounts).toEqual([row]);
    expect(result.some((g) => g.id === UNASSIGNED_CATEGORY)).toBe(false);
  });
  it("does not infer a category when the public name is ambiguous", () => {
    const rows = [
      account({ platform: "facebook", alias: "a", name: "Marca" }),
      account({ platform: "instagram", alias: "b", name: "Marca" }),
      account({ name: "Marca" }),
    ];
    const result = group(rows, [
      { categoryId: "node_tech", platform: "facebook", alias: "a" },
      { categoryId: "node_motion", platform: "instagram", alias: "b" },
    ]);
    expect(result.find((g) => g.id === UNASSIGNED_CATEGORY)?.accounts).toEqual([rows[2]]);
  });
  it("searches category names, platforms and account purpose while respecting the social filter", () => {
    const rows = [
      account({}),
      account({ platform: "facebook", alias: "pagina_3", name: "NodeTech", label: "Clientes" }),
    ];
    const groups = group(rows);
    expect(filterCategoryGroups(groups, "node_tech", "all")[0].accounts).toHaveLength(2);
    expect(filterCategoryGroups(groups, "facebook", "all")[0].accounts).toEqual([rows[1]]);
    expect(filterCategoryGroups(groups, "clientes", "facebook")[0].accounts).toEqual([rows[1]]);
    expect(filterCategoryGroups(groups, "clientes", "youtube")).toEqual([]);
    expect(filterCategoryGroups(groups, "", "all")).toHaveLength(3);
    expect(groups[0].accounts).toHaveLength(2);
  });
  it("keeps manually selected accounts grouped after their name and alias change", () => {
    const row = account({ name: "Nuevo nombre", alias: "otro_alias", targetId: "immutable-123" });
    const managed = [
      {
        id: "custom_atlas",
        displayName: "NodeAtlas",
        members: [{ platform: row.platform, targetId: row.targetId }],
      },
    ];
    const result = groupChannelsByCategory(
      [row],
      mergeChannelCategories(categories, managed),
      [],
      "Sin categoría",
      managed,
    );
    expect(result.find((item) => item.id === "custom_atlas")?.accounts).toEqual([row]);
    expect(result.some((item) => item.id === UNASSIGNED_CATEGORY)).toBe(false);
  });
  it("does not re-add accounts explicitly removed from an existing category", () => {
    const row = account({ targetId: "yt-tech" });
    const managed = [{ id: "node_tech", displayName: "NodeTech", members: [] }];
    const result = groupChannelsByCategory(
      [row],
      categories,
      [{ categoryId: "node_tech", platform: row.platform, alias: row.alias }],
      "Sin categoría",
      managed,
    );
    expect(result[0].accounts).toEqual([]);
    expect(result.find((item) => item.id === UNASSIGNED_CATEGORY)?.accounts).toEqual([row]);
  });
  it("does not transfer membership to a different ID reusing the alias or name", () => {
    const row = account({ targetId: "replacement-id" });
    const managed = [
      {
        id: "node_tech",
        displayName: "NodeTech",
        members: [{ platform: row.platform, targetId: "old-id" }],
      },
    ];
    const result = groupChannelsByCategory([row], categories, [], "Sin categoría", managed);
    expect(result[0].accounts).toEqual([]);
  });
  it("supports deliberate membership in multiple categories without duplicate cards", () => {
    const row = account({ targetId: "shared-id" });
    const member = { platform: row.platform, targetId: row.targetId };
    const managed = [
      { id: "node_tech", displayName: "NodeTech", members: [member, member] },
      { id: "node_motion", displayName: "NodeMotion", members: [member] },
    ];
    const result = groupChannelsByCategory([row], categories, [], "Sin categoría", managed);
    expect(result[0].accounts).toEqual([row]);
    expect(result[2].accounts).toEqual([row]);
    expect(mergeChannelCategories(categories, managed)).toHaveLength(categories.length);
  });
});
