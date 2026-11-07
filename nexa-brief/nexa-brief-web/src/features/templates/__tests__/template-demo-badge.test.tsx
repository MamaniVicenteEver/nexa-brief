import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { TemplateCard } from "../components/TemplateCard";
import type { Template } from "../types";

vi.mock("next/image", () => ({ default: () => <div /> }));
vi.mock("@/features/studio/components/TemplateStudioModal", () => ({
  TemplateStudioModal: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
vi.mock("@/shared/components/media/MediaPlayerModal", () => ({
  MediaPlayerModal: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
afterEach(cleanup);

const template = {
  id: "sample",
  displayName: "Muestra",
  nativeOrientation: "16:9",
  categoryName: "NodeMotion",
  showcaseUrl: "/api/showcase/sample",
} as Template;

function show(card: Template, showDemoBadge: boolean) {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <TemplateCard template={card} showDemoBadge={showDemoBadge} />
    </NextIntlClientProvider>,
  );
}

it("marca la vista de muestra de una plantilla", () => {
  show(template, true);
  expect(screen.getByText("Demo")).toBeDefined();
});

it("no marca otras tarjetas ni plantillas sin vista de muestra", () => {
  show(template, false);
  expect(screen.queryByText("Demo")).toBeNull();
  cleanup();
  show({ ...template, showcaseUrl: null }, true);
  expect(screen.queryByText("Demo")).toBeNull();
});
