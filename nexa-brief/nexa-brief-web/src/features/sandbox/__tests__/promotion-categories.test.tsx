import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SandboxItem } from "../types";
import { PromoteButton } from "../components/PromoteButton";

const mutate = vi.fn();
vi.mock("../components/PreparationButton", () => ({ PreparationButton: () => null }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/usePromoteSandboxItem", () => ({ usePromoteSandboxItem: () => ({ mutate, isPending: false }) }));
vi.mock("@/features/categories/hooks/useCategories", () => ({ useCategories: () => ({ data: [
  { id: "node_history", path: "node_history", displayName: "NodeHistory", engine: "explainer_kit", status: "active" },
  { id: "node_atlas", path: "node_atlas", displayName: "NodeAtlas", engine: "explainer_kit", status: "active" },
  { id: "node_politics", path: "node_politics", displayName: "NodePolitics", engine: "explainer_kit", status: "active" },
] }) }));
afterEach(() => { cleanup(); mutate.mockClear(); });

it("confirms one primary and several shared categories without moving on open", () => {
  const item = { id: "bolivia-mar", folder: "nodehistory", kind: "mapas", promotable: true } as SandboxItem;
  render(<PromoteButton item={item} folderLabel="NodeHistory" />);
  fireEvent.click(screen.getByRole("button", { name: "promote" }));
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "NodeAtlas" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "NodePolitics" }));
  fireEvent.click(screen.getByRole("button", { name: "promoteConfirm" }));
  expect(mutate).toHaveBeenCalledWith({ folder: "nodehistory", id: "bolivia-mar", category: "node_history", sharedCategories: ["node_atlas", "node_politics"] }, expect.any(Object));
});
