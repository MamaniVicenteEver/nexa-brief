"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { previewVoice } from "../api/explainer-service";
import type { ExplainerBrief } from "../types";

const INPUT_CLASS =
  "w-full rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink";
const LABEL_CLASS = "text-[11px] font-semibold text-nb-mute uppercase";

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] font-semibold text-nb-ink-soft"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-nb-line bg-white/50 p-4">
      <h4 className="text-[12px] font-bold tracking-[0.06em] text-nb-ink uppercase">{title}</h4>
      {children}
    </section>
  );
}

/** "Escuchar voz": sintetiza el gancho con la voz del diseño (Gemini TTS). */
function ListenButton({ text, voice }: { text: string; voice?: string }) {
  const t = useTranslations("explainer");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const { mutate, isPending } = useMutation({
    mutationFn: () => previewVoice({ text: text.slice(0, 600), voice }),
    onSuccess: (blob) => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      audioRef.current = new Audio(urlRef.current);
      void audioRef.current.play().catch(() => {});
    },
  });

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return (
    <button
      type="button"
      disabled={isPending || text.trim().length < 2}
      onClick={() => mutate()}
      className="rounded-full border border-nb-line px-3 py-1 text-[11px] font-semibold text-nb-ink-soft hover:border-nb-ink disabled:opacity-50"
    >
      {isPending ? t("brief.listening") : t("brief.listen")}
    </button>
  );
}

/** Resultado de "Generar textos": legible y con los textos principales editables. */
export function BriefEditor({
  brief,
  onChange,
  voice,
}: {
  brief: ExplainerBrief;
  onChange: (brief: ExplainerBrief) => void;
  voice?: string;
}) {
  const t = useTranslations("explainer");

  const setYoutube = (patch: Partial<ExplainerBrief["youtube"]>) =>
    onChange({ ...brief, youtube: { ...brief.youtube, ...patch } });
  const setFacebook = (patch: Partial<ExplainerBrief["facebook"]>) =>
    onChange({ ...brief, facebook: { ...brief.facebook, ...patch } });
  const setTiktok = (patch: Partial<ExplainerBrief["tiktok"]>) =>
    onChange({ ...brief, tiktok: { ...brief.tiktok, ...patch } });

  // Cambia una alternativa por el título principal (la anterior pasa a alternativa).
  const swapTitle = (index: number) => {
    const alternatives = [...brief.youtube.title_alternatives];
    const next = alternatives[index];
    alternatives[index] = brief.youtube.title;
    setYoutube({ title: next, title_alternatives: alternatives });
  };

  return (
    <div className="flex flex-col gap-3">
      <Block title={t("brief.idea")}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className={LABEL_CLASS}>{t("brief.hook")}</span>
            <ListenButton text={brief.hook} voice={voice} />
          </div>
          <p className="text-[13.5px] font-semibold text-nb-ink">{brief.hook}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.angle")}</span>
            <p className="text-[13px] text-nb-ink-soft">{brief.angle}</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.thesis")}</span>
            <p className="text-[13px] text-nb-ink-soft">{brief.thesis}</p>
          </div>
        </div>
        {brief.outline.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.outline")}</span>
            <ol className="list-decimal pl-5 text-[13px] text-nb-ink-soft">
              {brief.outline.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}
        {brief.thumbnail_text && (
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.thumbnail")}</span>
            <input
              value={brief.thumbnail_text}
              onChange={(e) => onChange({ ...brief, thumbnail_text: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        )}
        {brief.media_suggestions.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.mediaSuggestions")}</span>
            <ul className="list-disc pl-5 text-[12.5px] text-nb-mute">
              {brief.media_suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </Block>

      <Block title="YouTube">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{t("brief.title")}</span>
          <input
            value={brief.youtube.title}
            onChange={(e) => setYoutube({ title: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
        {brief.youtube.title_alternatives.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("brief.alternatives")}</span>
            <div className="flex flex-col gap-1">
              {brief.youtube.title_alternatives.map((alt, index) => (
                <button
                  key={alt}
                  type="button"
                  onClick={() => swapTitle(index)}
                  title={t("brief.useAlternative")}
                  className="rounded-xl border border-nb-line px-3 py-1.5 text-left text-[12.5px] text-nb-ink-soft hover:border-nb-ink"
                >
                  {alt}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{t("brief.description")}</span>
          <textarea
            rows={5}
            value={brief.youtube.description}
            onChange={(e) => setYoutube({ description: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
        <Chips items={brief.youtube.tags} />
      </Block>

      <Block title="Facebook">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{t("brief.title")}</span>
          <input
            value={brief.facebook.title}
            onChange={(e) => setFacebook({ title: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{t("brief.description")}</span>
          <textarea
            rows={3}
            value={brief.facebook.description}
            onChange={(e) => setFacebook({ description: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
      </Block>

      <Block title="TikTok">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{t("brief.caption")}</span>
          <textarea
            rows={3}
            value={brief.tiktok.caption}
            onChange={(e) => setTiktok({ caption: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
        <Chips items={brief.tiktok.hashtags} />
      </Block>
    </div>
  );
}
