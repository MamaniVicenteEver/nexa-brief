import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("hides the end card again when seeking back into the song", () => {
  const mod = {
    exports: {} as {
      createDOMOutro: (options: unknown) => {
        update: (t: number, d: number, ended: boolean) => { active: boolean };
        destroy: () => void;
      };
    },
  };
  const code = readFileSync(
    resolve(
      process.cwd(),
      "../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-manifiesto/components/outro.js",
    ),
    "utf8",
  );
  runInNewContext(code, { module: mod, globalThis: {}, innerWidth: 1920, innerHeight: 1080 });
  const root = document.createElement("div");
  const outro = mod.exports.createDOMOutro({ root, document, config: { leadSec: 8 } });
  expect(outro.update(230, 235, false).active).toBe(true);
  expect(document.body.classList.contains("outroActive")).toBe(true);
  expect(root.textContent?.match(/Gracias/g)).toHaveLength(1);
  expect(outro.update(20, 235, false).active).toBe(false);
  expect(root.style.opacity).toBe("0");
  expect(document.body.classList.contains("outroActive")).toBe(false);
  outro.destroy();
});
