import type { EngineName, RenderEngine, RenderInput } from "./port.js";
import { PlaywrightEngine } from "./playwright/playwright-engine.js";
import { RemotionEngine } from "./remotion/remotion-engine.js";
import { HyperframesEngine } from "./hyperframes/hyperframes-engine.js";

const engines: Record<EngineName, RenderEngine> = {
  playwright: new PlaywrightEngine(),
  remotion: new RemotionEngine(),
  hyperframes: new HyperframesEngine(),
};

/** Elección explícita — mismo rol que `get_recorder()` en
 * nexa-brief-server/src/adapters/recorder/factory.py. */
export function getEngine(name: EngineName): RenderEngine {
  return engines[name];
}

export function listEngines(): RenderEngine[] {
  return Object.values(engines);
}

/**
 * Regla de auto-selección — SIMPLE, no IA (ver
 * docs/investigaciones/sistema-independiente-render-engine.md sobre por qué
 * un "auto-decisor inteligente" queda para el final, no para v1):
 *
 *   1. ¿Viene un componente React?              -> Remotion
 *   2. ¿El HTML sigue la convención HyperFrames? -> HyperFrames
 *   3. Cualquier otra cosa                       -> Playwright (respaldo universal)
 */
export function selectEngine(input: RenderInput): RenderEngine {
  if (engines.remotion.canHandle(input)) return engines.remotion;
  if (engines.hyperframes.canHandle(input)) return engines.hyperframes;
  return engines.playwright;
}
