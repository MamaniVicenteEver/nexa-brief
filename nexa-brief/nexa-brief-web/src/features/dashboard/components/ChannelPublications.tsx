import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useChannelVideos } from "@/features/channels/hooks/useChannelVideos";
import type { ChannelPlatform } from "@/features/channels/types";
import { timestamp } from "../lib/operations";
import styles from "./dashboard.module.css";

function validUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Loaded only after expanding one account. The API returns cached Nexa records,
 * while Facebook's existing endpoint may refresh its cached posts. */
export function ChannelPublications({
  platform,
  alias,
  zone,
}: {
  platform: ChannelPlatform;
  alias: string;
  zone: string;
}) {
  const t = useTranslations("dashboard.channels");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, isError, refetch } = useChannelVideos(platform, alias, true);
  if (isLoading) return <p className={styles.channelHint}>{t("loadingPosts")}</p>;
  if (isError)
    return (
      <div className={styles.channelHint} role="alert">
        {t("postsError")}{" "}
        <button type="button" className={styles.textLink} onClick={() => void refetch()}>
          {t("retry")}
        </button>
      </div>
    );
  if (!data?.length) return <p className={styles.channelHint}>{t("noPosts")}</p>;
  const visible = showAll ? data : data.slice(0, 5);
  const number = new Intl.NumberFormat(locale);
  return (
    <>
      <ul className={styles.channelPosts}>
        {visible.map((video) => {
          const metrics = [
            video.metrics?.views != null
              ? t("postViews", { count: number.format(video.metrics.views) })
              : null,
            video.metrics?.likes != null
              ? t("postLikes", { count: number.format(video.metrics.likes) })
              : null,
            video.metrics?.comments != null
              ? t("postComments", { count: number.format(video.metrics.comments) })
              : null,
          ].filter(Boolean);
          return (
            <li key={video.postId}>
              {validUrl(video.url) ? (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.channelPostTitle}
                >
                  {video.title || t("untitled")} <ArrowUpRight size={12} aria-hidden />
                </a>
              ) : (
                <span className={styles.channelPostTitle}>{video.title || t("untitled")}</span>
              )}
              <span className={styles.channelHint}>
                {video.publishedAt > 0
                  ? timestamp(video.publishedAt, locale, zone)
                  : t("unknownDate")}
              </span>
              {metrics.length > 0 && (
                <span className={styles.channelHint}>{metrics.join(" · ")}</span>
              )}
            </li>
          );
        })}
      </ul>
      {data.length > 5 && (
        <button
          type="button"
          className={`${styles.textLink} mt-3`}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? t("showLessPosts") : t("showAllPosts", { count: data.length })}
        </button>
      )}
    </>
  );
}
