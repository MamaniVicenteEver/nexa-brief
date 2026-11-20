import { describe, expect, it } from "vitest";
import { missingMusicFields } from "../music-completion";

const fresh = { artist: "", description: "", tags: [] as string[] };

describe("missingMusicFields", () => {
  it("lista lo obligatorio que falta en una subida nueva", () => {
    expect(missingMusicFields(fresh)).toEqual(["artist", "description", "tags"]);
  });

  it("trata los espacios en blanco como vacío", () => {
    expect(missingMusicFields({ ...fresh, artist: "   " })).toContain("artist");
  });

  it("no pide nada cuando la ficha está completa", () => {
    expect(
      missingMusicFields({
        artist: "K/DA",
        description: "Sencillo de K/DA que anticipó el EP All Out.",
        tags: ["pop"],
      }),
    ).toEqual([]);
  });

  it("señala solo lo que falta", () => {
    expect(missingMusicFields({ artist: "K/DA", description: "", tags: [] })).toEqual([
      "description",
      "tags",
    ]);
  });

  it("no exige género: muchas fuentes no lo traen", () => {
    expect(missingMusicFields({ artist: "K/DA", description: "Sencillo.", tags: ["pop"] })).toEqual(
      [],
    );
  });
});
