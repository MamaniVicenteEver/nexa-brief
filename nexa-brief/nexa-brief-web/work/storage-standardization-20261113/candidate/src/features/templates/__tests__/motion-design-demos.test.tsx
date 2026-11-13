import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import type { CategoryNode } from "@/features/categories";
import messages from "../../../../messages/es.json";
import { groupMotionTemplates, MotionCategoryWindow } from "../components/MotionCategoryWindow";
import type { Template } from "../types";

vi.mock("../components/TemplateCard", () => ({
  TemplateCard: ({ template, showDemoBadge }: { template: Template; showDemoBadge: boolean }) => (
    <p>
      {template.displayName} · {showDemoBadge && template.showcaseUrl ? "Demo" : "Sin demo"}
    </p>
  ),
}));

it("separa las plantillas originales y señala las que tienen una vista de demostración", () => {
  const category = {
    id: "node_motion",
    displayName: "NodeMotion",
    niches: ["music"],
    children: [],
  } as unknown as CategoryNode;
  const template = {
    id: "lyrics",
    displayName: "Letras",
    nicheId: "music",
    sortOrder: 0,
    showcaseUrl: "/templates/lyrics",
  } as Template;
  const groups = groupMotionTemplates(category, [category], [template]);
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <MotionCategoryWindow category={category} groups={groups} isLoading={false} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("heading", { name: "Demos de diseño" })).toBeDefined();
  expect(screen.getByText("Letras · Demo")).toBeDefined();
});
