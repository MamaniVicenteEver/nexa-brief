import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RequirementsForm } from "../components/RequirementsForm";
import {
  buildDraftRequest,
  studioValueFromDraft,
  studioValueSignature,
} from "../lib/draft-request";
import type { Draft, StudioValue } from "../types";
import type { TemplateRequirements } from "@/features/templates/types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../components/AiMediaPanel", () => ({ AiMediaPanel: () => null }));
vi.mock("../components/MediaSlotField", () => ({
  MediaSlotField: () => <div>Fondo</div>,
}));
vi.mock("../components/SongField", () => ({ SongField: () => null }));
vi.mock("../components/TextsFields", () => ({ TextsFields: () => null }));
afterEach(cleanup);

const requirements = {
  audio: { required: false, lyrics: "none" },
  media: [
    {
      slot: "background",
      kind: "image|video",
      min: 1,
      max: 1,
      target: "source",
      label: "Fondo",
      hint: "",
      orientation: null,
    },
  ],
  texts: [],
  brief: false,
} as TemplateRequirements;
const value: StudioValue = {
  musicAssetId: null,
  media: { background: [{ assetId: "video-1", kind: "video" }] },
  texts: {},
  brief: "",
};

it("persists the adjusted visibility, restores it when reopening and marks the draft changed", () => {
  const adjusted = { ...value, mediaOpacity: { background: 0.35 } };
  const request = buildDraftRequest("lyrics-impact", requirements, adjusted);
  expect(request.template_inputs?.media_opacity).toEqual({ background: 0.35 });
  expect(request.video_asset_id).toBe("video-1");
  const draft = {
    inputs: {
      musicAssetId: null,
      imageAssetId: null,
      videoAssetId: "video-1",
      templateInputs: request.template_inputs,
    },
  } as Draft;
  const restored = studioValueFromDraft(draft, requirements);
  expect(restored.mediaOpacity).toEqual({ background: 0.35 });
  expect(studioValueSignature("lyrics-impact", requirements, restored)).toBe(
    studioValueSignature("lyrics-impact", requirements, adjusted),
  );
  expect(studioValueSignature("lyrics-impact", requirements, value)).not.toBe(
    studioValueSignature("lyrics-impact", requirements, adjusted),
  );
});

it("renders the visibility control for supported templates and sends the selected value", () => {
  const changed = vi.fn();
  render(
    <RequirementsForm
      templateId="lyrics-impact"
      requirements={requirements}
      value={value}
      onChange={changed}
      section="media"
    />,
  );
  const slider = screen.getByRole("slider", { name: /backgroundVisibility/ });
  expect((slider as HTMLInputElement).value).toBe("20");
  fireEvent.change(slider, { target: { value: "40" } });
  expect(changed).toHaveBeenCalledWith({
    ...value,
    mediaOpacity: { background: 0.6 },
  });
  expect(
    screen.getByText("backgroundVisibility").compareDocumentPosition(screen.getByText("Fondo")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("does not show a visibility control for an unrelated template", () => {
  render(
    <RequirementsForm
      templateId="other"
      requirements={requirements}
      value={value}
      onChange={() => {}}
      section="media"
    />,
  );
  expect(screen.queryByRole("slider")).toBeNull();
});
