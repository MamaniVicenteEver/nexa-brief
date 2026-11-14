import { type ExplainerJobDto, mapJob } from "@/features/explainer/api/explainer-service";
import { imagePostAssetUrl } from "@/features/image-posts/api/image-posts-api";
import { mapQueueEntry, type QueueEntryDto } from "@/features/schedule/api/schedule-service";
import { httpClient } from "@/infrastructure/api/http-client";
import { type JobListItemDto, mapJobListItem } from "../api/jobs-list-service";
import type {
  BibliotecaItem,
  BibliotecaPage,
  LibraryQuery,
  LibraryTab,
} from "../domain/biblioteca";
import type { LibraryStatus } from "../library-status";
import type { BibliotecaPort } from "../ports/biblioteca-port";

type ItemDto = {
  id: string;
  category_id: string;
  category_label: string;
  status: LibraryStatus;
} & (
  | {
      kind: "video";
      payload: { job: JobListItemDto; published: QueueEntryDto[]; scheduled: QueueEntryDto[] };
    }
  | { kind: "recording"; payload: ExplainerJobDto }
  | {
      kind: "image";
      payload: {
        post_id: string;
        publication_id: string;
        category_id: string;
        title: string;
        status: string;
        kind: "image" | "carousel";
        format: string;
        slide_count: number;
        cover_asset_id: string | null;
        updated_at: string;
      };
    }
);
interface PageDto {
  items: ItemDto[];
  total: number;
  page: number;
  page_size: number;
  unfiltered_total: number;
  categories: BibliotecaPage["categories"];
  status_counts: Record<LibraryTab, number>;
  has_active_jobs: boolean;
}
function mapItem(dto: ItemDto): BibliotecaItem {
  const base = { id: dto.id, categoryId: dto.category_id, categoryLabel: dto.category_label };
  if (dto.kind === "video")
    return {
      ...base,
      kind: "video",
      video: {
        job: mapJobListItem(dto.payload.job),
        categoryLabel: dto.category_label,
        status: dto.status,
        published: dto.payload.published.map(mapQueueEntry),
        scheduled: dto.payload.scheduled.map(mapQueueEntry),
      },
    };
  if (dto.kind === "recording")
    return { ...base, kind: "recording", recording: mapJob(dto.payload) };
  const item = dto.payload;
  return {
    ...base,
    kind: "image",
    image: {
      postId: item.post_id,
      publicationId: item.publication_id,
      categoryId: item.category_id,
      title: item.title,
      status: item.status,
      kind: item.kind,
      format: item.format,
      slideCount: item.slide_count,
      updatedAt: item.updated_at,
      coverUrl: item.cover_asset_id
        ? imagePostAssetUrl(item.publication_id, item.cover_asset_id)
        : null,
    },
  };
}
export const httpBibliotecaAdapter: BibliotecaPort = {
  async page(query: LibraryQuery, signal?: AbortSignal) {
    const params = new URLSearchParams({ ...query, page: String(query.page) });
    const dto = await httpClient<PageDto>(`/api/biblioteca?${params}`, {
      signal,
      sameOrigin: true,
    });
    return {
      items: dto.items.map(mapItem),
      total: dto.total,
      page: dto.page,
      pageSize: dto.page_size,
      unfilteredTotal: dto.unfiltered_total,
      categories: dto.categories,
      statusCounts: dto.status_counts,
      hasActiveJobs: dto.has_active_jobs,
    };
  },
};
