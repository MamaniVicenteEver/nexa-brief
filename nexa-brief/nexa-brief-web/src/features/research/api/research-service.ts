import { httpResearchAdapter } from "../adapters/http-research";
import type { ResearchAssetsPort } from "../ports/research-port";

export type * from "../domain/research";

// Composición: cambiar el proveedor aquí no cambia componentes ni hooks.
const research: ResearchAssetsPort = httpResearchAdapter;
export const getResearchPage = research.page.bind(research);
export const getResearchCategories = research.categories.bind(research);
export const getResearchDetail = research.get.bind(research);
export const syncResearch = research.sync.bind(research);
