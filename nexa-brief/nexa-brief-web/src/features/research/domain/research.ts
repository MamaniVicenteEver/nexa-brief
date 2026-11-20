/** Investigación de un video, tal como la muestra la pestaña Investigaciones de Recursos. */

export interface ResearchCounts {
  findings: number;
  sources: number;
  discarded: number;
  images: number;
  files: number;
  videos: number;
}

/** Una tarjeta: la versión más nueva de un tema, con cuántas versiones tiene. */
export interface ResearchCard {
  id: string;
  topic: string;
  researchedAt: string;
  originRoot: string;
  originCategory: string;
  originVideoId: string;
  originPath: string;
  revision: string;
  versionCount: number;
  tags: string[];
  counts: ResearchCounts;
  coverUrl: string | null;
}

export interface ResearchPage {
  items: ResearchCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResearchPageParams {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface ResearchSource {
  title: string;
  url: string;
  dataDate: string;
  accessedAt: string;
}

export interface ResearchFinding {
  id: string;
  claim: string;
  strength: number | null;
  recency: string;
  sources: ResearchSource[];
}

export interface ResearchDiscarded {
  claim: string;
  reason: string;
}

export interface ResearchImage {
  path: string;
  url: string;
  sourceUrl: string;
  license: string;
  credit: string;
}

export interface ResearchFile {
  path: string;
  url: string;
  bytes: number;
}

export interface ResearchVersion {
  id: string;
  revision: string;
  researchedAt: string;
  topic: string;
}

export interface ResearchUsage {
  videoId: string;
  at: string;
}

export interface ResearchDetail {
  id: string;
  topic: string;
  researchedAt: string;
  originRoot: string;
  originCategory: string;
  originVideoId: string;
  originPath: string;
  revision: string;
  tags: string[];
  counts: ResearchCounts;
  summary: string;
  findings: ResearchFinding[];
  discarded: ResearchDiscarded[];
  images: ResearchImage[];
  files: ResearchFile[];
  versions: ResearchVersion[];
  usedBy: ResearchUsage[];
}

export interface ResearchSyncReport {
  folders: number;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
}
