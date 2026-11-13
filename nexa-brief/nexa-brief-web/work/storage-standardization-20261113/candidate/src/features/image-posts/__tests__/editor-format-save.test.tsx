import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { ImagePostEditor } from "../components/ImagePostEditor";
import { setImagePostFormat } from "../image-posts-service";
import type { ImagePost } from "../types";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../hooks/useImagePosts", () => ({
  useImagePostActions: () => {
    const idle = { isPending: false, mutateAsync: vi.fn() };
    return {
      createPlanMutation: idle,
      renderPlanMutation: idle,
      saveMutation: { ...idle, mutateAsync: save },
      reviewMutation: idle,
      scheduleMutation: idle,
      publishMutation: idle,
      cancelMutation: idle,
      reconcileMutation: idle,
    };
  },
}));
vi.mock("../api/image-posts-api", () => ({
  fetchLicensedMusic: async () => ({ tracks: [] }),
}));
vi.mock("../image-posts-service", () => ({
  getImagePost: vi.fn(),
  setImagePostFormat: vi.fn(),
}));
vi.mock("../components/CodeSlidePreview", () => ({
  CodeSlidePreview: () => null,
}));

const original: ImagePost = {
  postId: "img_edit",
  categoryId: "node_tech",
  sourceVideoId: "video",
  planId: "plan",
  planHash: "hash",
  kind: "image",
  templateId: "daily_fact",
  strategyId: "fact",
  styleId: "rough",
  format: "4:5",
  title: "Historia verificada",
  copy: {
    facebook: { caption: "Texto inicial", firstComment: "" },
    instagram: { caption: "Texto inicial", firstComment: "" },
    hashtags: [],
  },
  slides: [
    {
      slideId: "s1",
      order: 1,
      assetId: "a1",
      altTextFacebook: "Contexto del dato",
      altTextInstagram: "Contexto del dato",
      previewUrl: "/preview.jpg",
    },
  ],
  music: { mode: "none" },
  reviewRequired: true,
  status: "ready_for_review",
  revision: 7,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  validationErrors: [],
  validationWarnings: [],
  deliveries: [],
  renderSeconds: 1,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("guardar formato y cambios editoriales", () => {
  it("conserva el texto editado y la revisión exportada si guardar el copy falla", async () => {
    const exported: ImagePost = { ...original, format: "9:16", revision: 8 };
    vi.mocked(setImagePostFormat).mockResolvedValue(exported);
    save.mockRejectedValueOnce(new Error("No se guardó el texto")).mockResolvedValueOnce({
      ...exported,
      revision: 9,
      copy: {
        ...exported.copy,
        facebook: { caption: "Texto que debe conservarse", firstComment: "" },
      },
    });
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <ImagePostEditor
          categoryId="node_tech"
          categoryName="NodeTech"
          sources={[{ videoId: "video", title: "Origen" }]}
          styles={[
            {
              styleId: "rough",
              categoryId: "node_tech",
              version: "1",
              designId: "rough",
              label: "Rough",
            },
          ]}
          strategies={[
            {
              id: "fact",
              name: "Dato",
              description: "",
              goal: "",
              templateId: "daily_fact",
              factsNeeded: 1,
            },
          ]}
          capabilities={{ accounts: [], reviewRequired: true }}
          isDemoData={false}
          post={original}
          onClose={() => {}}
          onPostCreated={() => {}}
        />
      </NextIntlClientProvider>,
    );
    const caption = screen.getByRole("textbox", {
      name: /Caption de Facebook/,
    });
    fireEvent.change(caption, {
      target: { value: "Texto que debe conservarse" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Formato 9:16, 1080 por 1920 píxeles",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("No se guardó el texto");
    expect((caption as HTMLTextAreaElement).value).toBe("Texto que debe conservarse");
    expect(save.mock.calls[0][0].patch.revision).toBe(8);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].patch.revision).toBe(8);
    expect(save.mock.calls[1][0].patch.copy.facebook.caption).toBe("Texto que debe conservarse");
    expect(setImagePostFormat).toHaveBeenCalledTimes(1);
  });
});
