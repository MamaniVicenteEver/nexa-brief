import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PromoPreviewButton } from "../components/sandbox/PromoPreviewButton";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";
import { promoPrototypeGroups } from "../lib/promo-prototypes";
import type { PromoSession } from "../api/promo-service";

afterEach(cleanup);

it("counts each session once, retains failed sessions, and excludes all its draft revisions", () => {
  const sessions = [
    { session_id: "one", state: "review", draft_id: "current", draft_history: ["old"] },
    { session_id: "failed", state: "failed", draft_id: null },
  ] as PromoSession[];
  const prototypes = [{ draftId: "current" }, { draftId: "old" }, { draftId: "legacy" }] as TemplateStudioController["prototypes"];
  const result = promoPrototypeGroups([...sessions, sessions[0]], prototypes);
  expect(result.count).toBe(3);
  expect(result.legacy.map((item) => item.draftId)).toEqual(["legacy"]);
  expect(result.sessions.map((item) => item.session_id)).toEqual(["one", "failed"]);
  const afterArchive = promoPrototypeGroups(sessions, [...prototypes, { draftId: "archived" }] as TemplateStudioController["prototypes"], ["archived"]);
  expect(afterArchive.count).toBe(3);
  expect(afterArchive.legacy.map((item) => item.draftId)).toEqual(["legacy"]);
});

it("plays the selected preview independently and hides play when no preview exists", () => {
  const previewPrototype = vi.fn();
  const studio = { prototypes: [{ draftId: "a", name: "Alfa", previewUrl: "/a" }, { draftId: "b", name: "Beta", previewUrl: "/b" }, { draftId: "c", previewUrl: null }], previewPrototype } as unknown as TemplateStudioController;
  const { rerender } = render(<PromoPreviewButton studio={studio} draftId="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Reproducir Alfa" }));
  rerender(<PromoPreviewButton studio={studio} draftId="b" />);
  fireEvent.click(screen.getByRole("button", { name: "Reproducir Beta" }));
  expect(previewPrototype.mock.calls).toEqual([["a"], ["b"]]);
  rerender(<PromoPreviewButton studio={studio} draftId="c" />);
  expect(screen.queryByRole("button")).toBeNull();
});
