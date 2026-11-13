import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { captureThumbnails, chooseThumbnail, recordExplainerVideo } from "../api/explainer-service";

vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (url: string) => url,
}));
beforeEach(() => vi.clearAllMocks());

describe("peticiones de estudio por idioma", () => {
  it("captura sólo la edición solicitada, conservando only_missing", async () => {
    vi.mocked(httpClient).mockResolvedValue({ chosen: "C", options: [] } as never);
    await captureThumbnails("episode one", true, { locale: "pt-BR", revision: "rev-002" });
    expect(httpClient).toHaveBeenCalledWith(
      "/api/v1/explainer/videos/episode%20one/thumbnails?only_missing=true&locale=pt-BR&revision=rev-002",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("elegir miniatura incluye idioma y revisión, sin caer en ES", async () => {
    vi.mocked(httpClient).mockResolvedValue({ chosen: "B", options: [] } as never);
    await chooseThumbnail("episode", "B", { locale: "en-US", revision: "rev-005" });
    expect(httpClient).toHaveBeenCalledWith(
      "/api/v1/explainer/videos/episode/thumbnail?locale=en-US&revision=rev-005",
      expect.objectContaining({ method: "PUT", body: { option: "B" } }),
    );
  });
  it("conserva el contrato original para ES", async () => {
    vi.mocked(httpClient).mockResolvedValue({ chosen: "A", options: [] } as never);
    await chooseThumbnail("episode", "A");
    expect(httpClient).toHaveBeenCalledWith(
      "/api/v1/explainer/videos/episode/thumbnail",
      expect.objectContaining({ body: { option: "A" } }),
    );
  });
  it("envía locale/revision al grabador y conserva la procedencia devuelta", async () => {
    vi.mocked(httpClient).mockResolvedValue({
      job_id: "job-en",
      video_id: "episode",
      locale: "en-US",
      revision: "rev-005",
      state: "queued",
      publish_results: [],
    } as never);
    const job = await recordExplainerVideo({
      videoId: "episode",
      locale: "en-US",
      revision: "rev-005",
      duration: "full",
      publish: false,
      privacy: "private",
    });
    expect(httpClient).toHaveBeenCalledWith(
      "/api/v1/explainer/videos/episode/record",
      expect.objectContaining({
        body: expect.objectContaining({ locale: "en-US", revision: "rev-005", publish: false }),
      }),
    );
    expect(job).toMatchObject({ jobId: "job-en", locale: "en-US", revision: "rev-005" });
  });
});
