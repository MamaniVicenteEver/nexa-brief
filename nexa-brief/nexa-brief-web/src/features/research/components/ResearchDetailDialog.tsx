"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useResearchDetail } from "../hooks/useResearch";

interface ResearchDetailDialogProps {
  researchId: string | null;
  onOpenChange: (open: boolean) => void;
  onSelectVersion: (researchId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const externalLink = "underline underline-offset-2 hover:text-nb-ink";

/** Detalle de una investigación: resumen, hallazgos con fuentes, imágenes, videos y archivos. */
export function ResearchDetailDialog({
  researchId,
  onOpenChange,
  onSelectVersion,
}: ResearchDetailDialogProps) {
  const t = useTranslations("resources.research.detail");
  const detail = useResearchDetail(researchId);
  const data = detail.data;

  return (
    <Dialog open={researchId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] gap-4 overflow-y-auto rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle className="pr-8 leading-snug">{data?.topic ?? ""}</DialogTitle>
          <DialogDescription>
            {data
              ? [data.researchedAt, data.originCategory, data.originPath]
                  .filter(Boolean)
                  .join(" · ")
              : ""}
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading && <p className="text-sm text-nb-mute">{t("loading")}</p>}
        {detail.isError && <p className="text-sm text-nb-accent-coral">{t("error")}</p>}

        {data && (
          <>
            {data.versions.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-nb-mute">{t("versions")}:</span>
                {data.versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    aria-pressed={version.id === data.id}
                    onClick={() => onSelectVersion(version.id)}
                    className={
                      version.id === data.id
                        ? "rounded-full bg-nb-ink px-2.5 py-1 font-semibold text-nb-surface"
                        : "rounded-full border border-nb-line px-2.5 py-1 text-nb-ink-soft hover:bg-nb-bg-2"
                    }
                  >
                    {version.revision || t("baseVersion")} · {version.researchedAt}
                  </button>
                ))}
              </div>
            )}

            <Tabs key={data.id} defaultValue="summary">
              <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="summary">{t("tabs.summary")}</TabsTrigger>
                <TabsTrigger value="findings">
                  {t("tabs.findings")} ({data.findings.length})
                </TabsTrigger>
                <TabsTrigger value="images">
                  {t("tabs.images")} ({data.images.length})
                </TabsTrigger>
                <TabsTrigger value="videos">
                  {t("tabs.videos")} ({data.usedBy.length})
                </TabsTrigger>
                <TabsTrigger value="files">
                  {t("tabs.files")} ({data.files.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <pre className="max-h-[52dvh] overflow-y-auto rounded-xl bg-nb-bg/70 p-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap break-words text-nb-ink-soft">
                  {data.summary || t("noSummary")}
                </pre>
              </TabsContent>

              <TabsContent value="findings">
                {data.findings.length === 0 ? (
                  <p className="text-sm text-nb-mute">{t("noFindings")}</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {data.findings.map((finding) => (
                      <li
                        key={finding.id || finding.claim}
                        className="rounded-xl border border-nb-line p-3"
                      >
                        <p className="text-[13.5px] font-semibold text-nb-ink">{finding.claim}</p>
                        <p className="mt-1 text-[11.5px] text-nb-mute">
                          {[
                            finding.strength !== null
                              ? t("strength", { value: finding.strength })
                              : "",
                            finding.recency,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {finding.sources.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {finding.sources.map((source) => (
                              <li
                                key={source.url || source.title}
                                className="text-[12px] text-nb-ink-soft"
                              >
                                {source.url ? (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={externalLink}
                                  >
                                    {source.title || source.url}
                                  </a>
                                ) : (
                                  source.title
                                )}
                                {source.dataDate ? ` · ${source.dataDate}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {data.discarded.length > 0 && (
                  <section className="mt-5">
                    <h4 className="text-[11px] font-semibold tracking-wide text-nb-mute uppercase">
                      {t("discarded")}
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {data.discarded.map((item) => (
                        <li key={item.claim} className="text-[12.5px] text-nb-ink-soft">
                          <span className="font-medium">{item.claim}</span>
                          {item.reason && <span className="text-nb-mute"> — {item.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="images">
                {data.images.length === 0 ? (
                  <p className="text-sm text-nb-mute">{t("noImages")}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {data.images.map((image) => (
                      <figure
                        key={image.path}
                        className="overflow-hidden rounded-xl border border-nb-line bg-nb-bg/60"
                      >
                        <a href={image.url} target="_blank" rel="noopener noreferrer">
                          {/* biome-ignore lint/performance/noImgElement: URL del backend, no un asset estático de Next */}
                          <img
                            src={image.url}
                            alt={image.path}
                            loading="lazy"
                            className="aspect-video w-full bg-nb-bg-2 object-cover"
                          />
                        </a>
                        <figcaption className="space-y-0.5 p-2 text-[11px] text-nb-mute">
                          <p className="truncate text-nb-ink-soft" title={image.path}>
                            {image.path}
                          </p>
                          <p>{image.license || t("licenseUnverified")}</p>
                          {image.credit && (
                            <p>
                              {t("author")}: {image.credit}
                            </p>
                          )}
                          {image.sourceUrl && (
                            <a
                              href={image.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={externalLink}
                            >
                              {t("source")}
                            </a>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="videos">
                {data.usedBy.length === 0 ? (
                  <p className="text-sm text-nb-mute">{t("noVideos")}</p>
                ) : (
                  <ul className="divide-y divide-nb-line rounded-xl border border-nb-line">
                    {data.usedBy.map((usage) => (
                      <li
                        key={`${usage.videoId}-${usage.at}`}
                        className="px-3 py-2 text-[12.5px] text-nb-ink-soft"
                      >
                        {usage.videoId} · {usage.at}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="files">
                <ul className="divide-y divide-nb-line rounded-xl border border-nb-line">
                  {data.files.map((file) => (
                    <li
                      key={file.path}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]"
                    >
                      <span className="truncate text-nb-ink-soft" title={file.path}>
                        {file.path}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-nb-mute">
                        {formatBytes(file.bytes)}
                        <a
                          href={file.url}
                          download
                          className="font-semibold text-nb-green-dark underline underline-offset-2"
                        >
                          {t("download")}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
