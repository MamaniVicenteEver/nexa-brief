import { describe, expect, it } from "vitest";
import { mapResearchCard, mapResearchDetail } from "../adapters/http-research";

const counts = { findings: 2, sources: 3, discarded: 1, images: 1, files: 4, videos: 0 };

describe("mapResearchCard", () => {
  it("convierte el DTO del servidor en la tarjeta de la pantalla", () => {
    const card = mapResearchCard({
      research_id: "81e15c5914aca54d",
      topic: "PULSO, club de running",
      researched_at: "2026-11-13",
      origin_root: "sandbox",
      origin_category: "nodemotion",
      origin_video_id: "pulso",
      origin_path: "sandbox/nodemotion/pulso/work/research",
      revision: "r1",
      version_count: 2,
      tags: ["sandbox", "nodemotion"],
      counts,
      cover_url: "/api/v1/library/research/81e15c5914aca54d/file/medios/foto.jpg",
    });

    expect(card).toMatchObject({
      id: "81e15c5914aca54d",
      topic: "PULSO, club de running",
      researchedAt: "2026-11-13",
      originCategory: "nodemotion",
      versionCount: 2,
      counts,
    });
    expect(card.coverUrl).toBe("/api/v1/library/research/81e15c5914aca54d/file/medios/foto.jpg");
  });

  it("deja la portada vacía cuando la investigación no tiene imágenes", () => {
    const card = mapResearchCard({
      research_id: "abc",
      topic: "Tema",
      researched_at: "",
      origin_root: "production",
      origin_category: "nodeatlas",
      origin_video_id: "atlas",
      origin_path: "productions/nodeatlas/atlas/work/research",
      revision: "",
      version_count: 1,
      tags: [],
      counts,
      cover_url: null,
    });
    expect(card.coverUrl).toBeNull();
  });
});

describe("mapResearchDetail", () => {
  it("mantiene hallazgos, fuentes, videos que la usan y archivos", () => {
    const detail = mapResearchDetail({
      research_id: "81e15c5914aca54d",
      topic: "PULSO",
      researched_at: "2026-11-13",
      origin_root: "sandbox",
      origin_category: "nodemotion",
      origin_video_id: "pulso",
      origin_path: "sandbox/nodemotion/pulso/work/research",
      revision: "",
      tags: [],
      counts: { ...counts, videos: 1 },
      summary: "# PULSO",
      findings: [
        {
          id: "F1",
          claim: "Hecho uno",
          strength: 3,
          recency: "2022",
          sources: [
            {
              title: "A",
              url: "https://a.example/1",
              data_date: "2022-05-15",
              accessed_at: "2026-11-13",
            },
          ],
        },
      ],
      discarded: [{ claim: "Descartado", reason: "Sin fuente" }],
      images: [
        {
          path: "medios/foto.jpg",
          url: "/api/v1/library/research/81e15c5914aca54d/file/medios/foto.jpg",
          source_url: "https://c.example/f",
          license: "CC BY 4.0",
          credit: "Autor",
        },
      ],
      files: [
        {
          path: "research.json",
          url: "/api/v1/library/research/81e15c5914aca54d/file/research.json",
          bytes: 2583,
        },
      ],
      versions: [
        {
          research_id: "81e15c5914aca54d",
          revision: "",
          researched_at: "2026-11-13",
          topic: "PULSO",
        },
      ],
      used_by: [{ video_id: "video-1", at: "2026-11-15" }],
    });

    expect(detail.findings[0].sources[0]).toEqual({
      title: "A",
      url: "https://a.example/1",
      dataDate: "2022-05-15",
      accessedAt: "2026-11-13",
    });
    expect(detail.images[0]).toMatchObject({
      license: "CC BY 4.0",
      credit: "Autor",
      sourceUrl: "https://c.example/f",
    });
    expect(detail.usedBy).toEqual([{ videoId: "video-1", at: "2026-11-15" }]);
    expect(detail.files[0].bytes).toBe(2583);
    expect(detail.versions[0].id).toBe("81e15c5914aca54d");
  });
});
