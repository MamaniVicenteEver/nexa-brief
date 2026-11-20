import type {
  ResearchDetail,
  ResearchPage,
  ResearchPageParams,
  ResearchSyncReport,
} from "../domain/research";

/** Contrato de las investigaciones. HTTP y los DTO del backend quedan en el adaptador. */
export interface ResearchAssetsPort {
  page(params: ResearchPageParams, signal?: AbortSignal): Promise<ResearchPage>;
  categories(signal?: AbortSignal): Promise<string[]>;
  get(researchId: string, signal?: AbortSignal): Promise<ResearchDetail>;
  sync(): Promise<ResearchSyncReport>;
}
