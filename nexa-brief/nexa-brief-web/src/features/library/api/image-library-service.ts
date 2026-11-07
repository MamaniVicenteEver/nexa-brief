import { requestJson } from "@/features/image-posts/api/client";
import { imagePostAssetUrl } from "@/features/image-posts/api/image-posts-api";

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

interface ImagePostDto {
  post_id: string;
  publication_id: string;
  status: string;
  updated_at: string;
  editorial: { category_id: string; title: string; topic?: string | null };
  technical: {
    kind: "image" | "carousel";
    composition_plan?: { format?: string; slides?: unknown[] };
    slides?: Array<{ asset_id: string; order: number }>;
  };
}

interface ImagePostPage {
  items: ImagePostDto[];
  next_cursor: string | null;
}

/** The server can return an empty page before the cursor is exhausted. */
export async function getImageLibrary(
  category: string,
  signal?: AbortSignal,
): Promise<LibraryImagePost[]> {
  const result: LibraryImagePost[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (category) query.set("category_id", category);
    if (cursor) query.set("cursor", cursor);
    const page: ImagePostPage = await requestJson(`/api/image-posts?${query}`, { signal });
    for (const item of page.items) {
      const slides = [...(item.technical.slides ?? [])].sort((a, b) => a.order - b.order);
      result.push({
        postId: item.post_id,
        publicationId: item.publication_id,
        categoryId: item.editorial.category_id,
        title: item.editorial.title || item.editorial.topic || item.post_id,
        status: item.status,
        kind: item.technical.kind,
        format: item.technical.composition_plan?.format ?? "",
        slideCount: slides.length || item.technical.composition_plan?.slides?.length || 0,
        coverUrl: slides[0]?.asset_id
          ? imagePostAssetUrl(item.publication_id, slides[0].asset_id)
          : null,
        updatedAt: item.updated_at,
      });
    }
    cursor = page.next_cursor;
    if (cursor && seen.has(cursor)) throw new Error("Repeated image library cursor");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return result;
}
