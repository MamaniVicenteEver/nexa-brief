"use client";

import { Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PublishedPostModal } from "@/features/image-posts/components/PublishedPostModal";
import type { BibliotecaItem, LibraryImagePost } from "../domain/biblioteca";

export function ImageLibrary({ items }: { items: Extract<BibliotecaItem, { kind: "image" }>[] }) {
  const statusText = useTranslations("imagePosts.status");
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ImageCard
            key={item.id}
            post={item.image}
            category={item.categoryLabel}
            status={
              statusText.has(item.image.status) ? statusText(item.image.status) : item.image.status
            }
            onOpen={() => setSelectedPost(item.image.postId)}
          />
        ))}
      </div>
      <PublishedPostModal
        summary={null}
        postId={selectedPost}
        open={Boolean(selectedPost)}
        onOpenChange={(open) => {
          if (!open) setSelectedPost(null);
        }}
      />
    </>
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
