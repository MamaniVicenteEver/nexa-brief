"use client";

import {
  CalendarClock,
  CirclePlus,
  Images,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CategoryNode } from "@/features/categories";
import { useExplainerVideos } from "@/features/explainer";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  useImageEditorOptions,
  useImagePost,
  useImagePostActions,
  useImagePosts,
  useImageStrategies,
} from "../hooks/useImagePosts";
import type { ImagePost } from "../types";
import { ImagePostEditor, type ImageSourceOption } from "./ImagePostEditor";
import { PublishedGallery } from "./PublishedGallery";

type SectionTab = "posts" | "gallery";

function statusTone(status: ImagePost["status"]) {
  if (["approved", "completed"].includes(status)) return "bg-nb-green/50 text-[#31583d]";
  if (["failed", "partial", "outcome_unknown"].includes(status)) return "bg-red-100 text-red-800";
  if (["scheduled", "ready_for_review", "rendered"].includes(status))
    return "bg-[#fff0c6] text-[#755a17]";
  return "bg-nb-bg-2 text-nb-ink-soft";
}

function localDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function PublicationsSection({
  category,
  categories,
}: {
  category: CategoryNode;
  categories: CategoryNode[];
}) {
  const t = useTranslations("imagePosts");
  const [tab, setTab] = useState<SectionTab>("posts");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const postsQuery = useImagePosts(category.id);
  const { styles, capabilities } = useImageEditorOptions(category.id);
  const strategies = useImageStrategies();
  const videosQuery = useExplainerVideos(category.path);
  const postDetail = useImagePost(selectedPostId);
  const actions = useImagePostActions();
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [remoteIds, setRemoteIds] = useState<Record<string, string>>({});
  const posts = postsQuery.data ?? [];
  const realSources = (videosQuery.data ?? [])
    .filter((video) => video.ready && video.publishReady && !video.demo)
    .map((video) => ({
      videoId: video.videoId,
      title: video.youtubeTitle || video.title || video.videoId,
    }));
  const demoData = Boolean(
    capabilities.data?.isDemo ||
      styles.data?.some((style) => style.isDemo) ||
      posts.some((post) => post.isDemo),
  );
  const sources: ImageSourceOption[] =
    realSources.length || !demoData
      ? realSources
      : [{ videoId: "video-demo-sintetico", title: t("editor.demoSource"), demo: true }];
  const selectedPost =
    postDetail.data?.postId === selectedPostId
      ? postDetail.data
      : (posts.find((post) => post.postId === selectedPostId) ?? null);
  const ready = !styles.isLoading && !capabilities.isLoading && !strategies.isLoading;

  function openEditor(postId: string | null) {
    setSelectedPostId(postId);
    setEditorSession((current) => current + 1);
    setEditorOpen(true);
  }

  return (
    <section
      className="mt-14 flex flex-col gap-6 border-t border-nb-line pt-8"
      aria-labelledby={`publications-heading-${category.id}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-nb-mute uppercase">
            {category.displayName}
          </p>
          <h2
            id={`publications-heading-${category.id}`}
            className="mt-1 text-[25px] font-extrabold tracking-[-0.03em] text-nb-ink"
          >
            {t("section.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-nb-ink-soft">{t("section.description")}</p>
        </div>
        {tab === "posts" && (
          <button
            type="button"
            onClick={() => openEditor(null)}
            disabled={!ready || !sources.length}
            className="nb-btn-pill inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            <CirclePlus className="size-4" aria-hidden />
            {t("section.newPost")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={t("section.tabsLabel")}
          className="flex gap-1 rounded-full border border-nb-line bg-white/70 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "posts"}
            onClick={() => setTab("posts")}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-bold",
              tab === "posts" ? "bg-nb-ink text-white" : "text-nb-ink-soft hover:text-nb-ink",
            )}
          >
            <Send className="mr-1.5 inline size-3.5" aria-hidden />
            {t("section.postsTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gallery"}
            onClick={() => setTab("gallery")}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-bold",
              tab === "gallery" ? "bg-nb-ink text-white" : "text-nb-ink-soft hover:text-nb-ink",
            )}
          >
            <Images className="mr-1.5 inline size-3.5" aria-hidden />
            {t("section.galleryTab")}
          </button>
        </div>
        {tab === "posts" && (
          <button
            type="button"
            onClick={() => void postsQuery.refetch()}
            disabled={postsQuery.isFetching}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-nb-mute hover:text-nb-ink disabled:opacity-50"
          >
            <RefreshCw
              className={cn("size-3.5", postsQuery.isFetching && "animate-spin")}
              aria-hidden
            />
            {t("section.refresh")}
          </button>
        )}
      </div>

      {tab === "gallery" ? (
        <PublishedGallery categories={categories} initialCategoryId={category.id} />
      ) : (
        <div className="flex flex-col gap-4">
          {reconcileError && (
            <p role="alert" className="text-xs text-red-700">
              {reconcileError}
            </p>
          )}
          {demoData && (
            <p
              role="status"
              className="rounded-xl border border-[#dfbf69] bg-[#fff8e5] px-3 py-2.5 text-xs text-[#66501c]"
            >
              {t("section.demoNotice")}
            </p>
          )}
          {(videosQuery.isError || !realSources.length) && !demoData && (
            <p className="rounded-xl border border-dashed border-nb-line bg-white/60 p-4 text-xs leading-relaxed text-nb-mute">
              {t("section.noVerifiedSources")}
            </p>
          )}
          {postsQuery.isLoading || !ready ? (
            <div className="flex justify-center rounded-2xl border border-nb-line bg-white/50 py-14">
              <LoaderCircle
                className="size-5 animate-spin text-nb-mute"
                aria-label={t("section.loading")}
              />
            </div>
          ) : postsQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              {t("section.loadError")}
            </div>
          ) : posts.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {posts.map((post) => (
                <article
                  key={post.postId}
                  className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-nb-mute">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 capitalize",
                          statusTone(post.status),
                        )}
                      >
                        {t(`status.${post.status}`)}
                      </span>
                      <span>
                        {post.templateId === "five_slides"
                          ? t("gallery.kind.carousel")
                          : t("gallery.kind.image")}
                      </span>
                      <span>·</span>
                      <span>{t("section.revision", { revision: post.revision })}</span>
                      {post.isDemo && (
                        <span className="rounded-full bg-[#fff0c6] px-2 py-1 text-[#755a17]">
                          {t("gallery.demoBadge")}
                        </span>
                      )}
                    </div>
                    <h3 className="truncate text-sm font-extrabold text-nb-ink">
                      {post.title || t("editor.untitled")}
                    </h3>
                    <p className="mt-1 flex gap-1 text-[11px] text-nb-ink-soft">
                      <span>{t("editor.strategy")}:</span>
                      <span>
                        {strategies.data?.find((strategy) => strategy.id === post.strategyId)
                          ?.name ??
                          post.strategyId ??
                          t("common.noData")}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[11px] text-nb-mute">
                      {t("section.source")}:{" "}
                      {post.sourceTitle || post.sourceVideoId || t("common.noData")}
                    </p>
                    <p className="mt-1 text-[10px] text-nb-mute">
                      {t("section.updated", { date: localDateTime(post.updatedAt) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {post.deliveries
                      .filter((delivery) => delivery.status === "outcome_unknown")
                      .map((delivery) => (
                        <div
                          key={delivery.deliveryId}
                          className="flex flex-col items-end gap-1 text-[10px] text-red-800"
                        >
                          <span>
                            {delivery.platform} · {t("deliveryStatus.outcome_unknown")}
                          </span>
                          <span>
                            {delivery.nextAttemptAt
                              ? t("section.nextReconcile", {
                                  date: localDateTime(delivery.nextAttemptAt),
                                })
                              : t("section.manualReconcile")}
                          </span>
                          {!delivery.remote.postId && !delivery.remote.parentContainerId && (
                            <input
                              type="text"
                              value={remoteIds[delivery.deliveryId] ?? ""}
                              onChange={(event) =>
                                setRemoteIds((current) => ({
                                  ...current,
                                  [delivery.deliveryId]: event.target.value,
                                }))
                              }
                              placeholder={t("section.remoteIdPlaceholder")}
                              aria-label={t("section.remoteIdLabel")}
                              className="w-44 rounded-lg border border-red-200 px-2 py-1 text-nb-ink"
                            />
                          )}
                          <button
                            type="button"
                            disabled={
                              actions.reconcileMutation.isPending ||
                              (!delivery.remote.postId &&
                                !delivery.remote.parentContainerId &&
                                !(remoteIds[delivery.deliveryId] ?? "").trim())
                            }
                            onClick={async () => {
                              setReconcileError(null);
                              try {
                                await actions.reconcileMutation.mutateAsync({
                                  postId: post.postId,
                                  deliveryId: delivery.deliveryId,
                                  remotePostId: remoteIds[delivery.deliveryId]?.trim() || undefined,
                                });
                              } catch {
                                setReconcileError(t("section.reconcileError"));
                              }
                            }}
                            className="rounded-full border border-red-300 px-2.5 py-1 font-bold disabled:opacity-50"
                          >
                            {actions.reconcileMutation.isPending
                              ? t("section.reconciling")
                              : t("section.reconcile")}
                          </button>
                        </div>
                      ))}
                    {post.deliveries.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-nb-mute">
                        <CalendarClock className="size-3.5" aria-hidden />
                        {post.deliveries.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditor(post.postId)}
                      aria-label={t("section.editPost", {
                        title: post.title || t("editor.untitled"),
                      })}
                      className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold"
                    >
                      <PencilLine className="size-3.5" aria-hidden />
                      {t("section.edit")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-nb-line bg-white/60 p-9 text-center">
              <Images className="mx-auto size-7 text-nb-mute/50" aria-hidden />
              <h3 className="mt-3 text-sm font-bold text-nb-ink">{t("section.emptyTitle")}</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-nb-mute">
                {t("section.emptyDescription")}
              </p>
              <button
                type="button"
                onClick={() => openEditor(null)}
                disabled={!sources.length || !ready}
                className="nb-btn-pill mt-4 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {t("section.createFirst")}
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setSelectedPostId(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[94dvh] w-[calc(100vw-20px)] max-w-[1280px] overflow-y-auto rounded-[24px] border border-nb-line bg-[#f8f7f2] p-4 text-nb-ink sm:max-w-[1280px] sm:p-6"
        >
          <DialogTitle className="sr-only">
            {selectedPost ? t("editor.editTitle") : t("editor.newTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("editor.description")}</DialogDescription>
          {capabilities.data && styles.data && strategies.data ? (
            <ImagePostEditor
              key={`${category.id}:${editorSession}`}
              categoryId={category.id}
              categoryName={category.displayName}
              sources={sources}
              styles={styles.data}
              strategies={strategies.data}
              capabilities={capabilities.data}
              isDemoData={demoData}
              post={selectedPost}
              onClose={() => setEditorOpen(false)}
              onPostCreated={setSelectedPostId}
            />
          ) : (
            <div className="flex justify-center py-12">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
