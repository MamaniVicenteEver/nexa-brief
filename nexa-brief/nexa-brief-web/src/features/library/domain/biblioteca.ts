import type { ExplainerJob } from "@/features/explainer/types";
import type { LibraryVideo } from "../library-status";

export type LibraryMedia = "videos" | "images";
export type LibraryTab = "all" | "pending" | "published" | "processing" | "failed";
export type LibrarySort = "newest" | "oldest" | "longest" | "title";
export interface LibraryQuery {
  media: LibraryMedia;
  q: string;
  category: string;
  status: LibraryTab;
  sort: LibrarySort;
  page: number;
}
export interface LibraryImagePost {
  postId: string;
  publicationId: string;
  categoryId: string;
  title: string;
  status: string;
  kind: "image" | "carousel";
  format: string;
  slideCount: number;
  coverUrl: string | null;
  updatedAt: string;
}
interface LibraryItemBase {
  id: string;
  categoryId: string;
  categoryLabel: string;
}
export type BibliotecaItem = LibraryItemBase &
  (
    | { kind: "video"; video: LibraryVideo }
    | { kind: "recording"; recording: ExplainerJob }
    | { kind: "image"; image: LibraryImagePost }
  );
export interface BibliotecaPage {
  items: BibliotecaItem[];
  total: number;
  page: number;
  pageSize: number;
  unfilteredTotal: number;
  categories: { id: string; label: string; count: number }[];
  statusCounts: Record<LibraryTab, number>;
  hasActiveJobs: boolean;
}
