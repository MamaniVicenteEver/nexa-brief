"use client";

import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { type CategoryNode, useCategories } from "@/features/categories";
import { PublishedPostModal } from "@/features/image-posts/components/PublishedPostModal";
import { ApiError } from "@/infrastructure/api/api-error";
import { getImageLibrary, type LibraryImagePost } from "../api/image-library-service";

function categoryOptions(nodes: CategoryNode[], parent = ""): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => {
    const label = parent ? `${parent} › ${node.displayName}` : node.displayName;
    return [{ id: node.id, label }, ...categoryOptions(node.children, label)];
  });
}

export function ImageLibrary() {
  const t = useTranslations("library.images");
  const statusText = useTranslations("imagePosts.status");
  const { data: categories } = useCategories();
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const images = useQuery({
    queryKey: ["image-posts", "library", category],
    queryFn: ({ signal }) => getImageLibrary(category, signal),
    retry: (count, error) =>
      !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    refetchInterval: (result) =>
      result.state.data?.some((post) => post.status === "rendering") ? 3000 : false,
    refetchOnWindowFocus: false,
  });
  const options = useMemo(() => categoryOptions(categories ?? []), [categories]);
  const labels = useMemo(() => new Map(options.map((item) => [item.id, item.label])), [options]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (images.data ?? []).filter((post) =>
      [post.title, post.categoryId, labels.get(post.categoryId) ?? "", post.postId].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [images.data, labels, query]);
  const restricted = images.error instanceof ApiError && images.error.status === 403;

  return (
    <section aria-label={t("label")}>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="w-full rounded-full border border-nb-line bg-nb-surface py-2.5 pr-4 pl-10 text-[13.5px] text-nb-ink outline-none focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
          />
        </div>
        <label className="flex items-center gap-2 rounded-full border border-nb-line bg-nb-surface px-3.5 py-2 text-[12.5px] font-semibold text-nb-mute">
          {t("category")}
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="max-w-[220px] bg-transparent text-[13px] text-nb-ink outline-none"
          >
            <option value="">{t("allCategories")}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-6">
        {images.isLoading ? (
          <p role="status" className="text-sm text-nb-mute">
            {t("loading")}
          </p>
        ) : images.isError ? (
          <div role="alert" className="rounded-2xl border border-nb-line p-6 text-sm text-nb-mute">
            <p>{restricted && !category ? t("chooseCategory") : t("error")}</p>
            {!(restricted && !category) && (
              <button
                type="button"
                onClick={() => void images.refetch()}
                className="nb-btn-secondary mt-3 rounded-full px-4 py-2 font-semibold"
              >
                {t("retry")}
              </button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-nb-line p-8 text-center text-sm text-nb-mute">
            {query.trim() ? t("noResults") : t("empty")}
          </p>
        ) : (
          <>
            <p className="mb-4 text-[12.5px] text-nb-mute">
              {t("count", { count: visible.length })}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-5">
              {visible.map((post) => (
                <ImageCard
                  key={post.publicationId}
                  post={post}
                  category={labels.get(post.categoryId) ?? post.categoryId}
                  status={statusText.has(post.status) ? statusText(post.status) : post.status}
                  onOpen={() => setSelectedPost(post.postId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <PublishedPostModal
        summary={null}
        postId={selectedPost}
        open={Boolean(selectedPost)}
        onOpenChange={(open) => {
          if (!open) setSelectedPost(null);
        }}
      />
    </section>
  );
}

function ImageCard({
  post,
  category,
  status,
  onOpen,
}: {
  post: LibraryImagePost;
  category: string;
  status: string;
  onOpen: () => void;
}) {
  const t = useTranslations("library.images");
  const [failed, setFailed] = useState(false);
  return (
    <article className="group/card flex flex-col overflow-hidden rounded-[20px] bg-nb-surface shadow-[0_18px_34px_-18px_rgba(40,30,10,0.22),0_6px_14px_-6px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] transition-transform hover:-translate-y-0.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("openPost", { title: post.title })}
        className="block w-full text-left"
      >
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-nb-ink">
          {post.coverUrl && !failed ? (
            // biome-ignore lint/performance/noImgElement: authenticated preview is served by the session proxy.
            <img
              src={post.coverUrl}
              alt=""
              onError={() => setFailed(true)}
              className="size-full object-contain"
            />
          ) : (
            <ImageIcon aria-hidden className="size-8 text-white/40" />
          )}
        </div>
        <div className="flex flex-col gap-2.5 px-4.5 pt-3.5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className="min-w-0 truncate text-[11px] font-semibold tracking-[0.04em] text-nb-mute uppercase"
              title={category}
            >
              {category}
            </span>
            <span className="shrink-0 rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] font-semibold text-nb-ink-soft">
              {status}
            </span>
          </div>
          <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-bold tracking-[-0.015em] text-nb-ink">
            {post.title}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-nb-ink-soft">{t("view")}</span>
            <span className="text-[11px] font-semibold text-nb-mute">
              {t("slides", { count: post.slideCount })}
              {post.format ? ` · ${post.format}` : ""}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
