"use client";

import { useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { type ShowcaseEntry, safeShowcaseUrl } from "../api/standard-showcase-repository";

type CharacterDetails = {
  identity: {
    nombre?: string;
    tema?: string;
    objetivo?: string;
    personalidad?: string[];
    estilo?: string;
    voz?: {
      nombre?: string;
      modelo?: string;
      direccion?: string;
      aprobada?: boolean;
      estado?: string;
    };
  };
  voiceSample?: { url: string; captionsUrl?: string; text?: string; source?: string };
  poses?: { name: string; url: string }[];
};

export function StandardCharacterDetails({ entry }: { entry: ShowcaseEntry }) {
  const [failed, setFailed] = useState(false);
  const data = entry.data as { character?: CharacterDetails } | undefined;
  const details = data?.character;
  if (!details?.identity) return null;
  const identity = details.identity;
  const voice = identity.voz;
  const sample = details.voiceSample;
  const audio = safeShowcaseUrl(sample?.url);
  const captions = safeShowcaseUrl(sample?.captionsUrl);
  const name = identity.nombre ?? entry.label;
  return (
    <section aria-label={`Identidad de ${name}`} className="space-y-4 border-t border-nb-line pt-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Identidad y personalidad</h3>
        {identity.tema && <p className="text-sm font-medium">{identity.tema}</p>}
        {identity.objetivo && <p className="text-sm text-nb-ink-soft">{identity.objetivo}</p>}
        {identity.personalidad?.length ? (
          <p className="text-sm">{identity.personalidad.join(" · ")}</p>
        ) : null}
        {identity.estilo && <p className="text-sm text-nb-ink-soft">{identity.estilo}</p>}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Voz de {name}</h3>
        {voice && (
          <p className="text-sm">
            {voice.nombre} · {voice.modelo}
          </p>
        )}
        {voice && (
          <p className="text-xs text-nb-ink-soft">
            {voice.aprobada || voice.estado === "perfil_existente_aprobado"
              ? "Timbre seleccionado"
              : "Muestra pendiente de selección"}
          </p>
        )}
        {voice?.direccion && <p className="text-xs text-nb-ink-soft">{voice.direccion}</p>}
        {audio ? (
          // biome-ignore lint/a11y/useMediaCaption: el texto de la muestra se muestra debajo cuando está disponible.
          <audio
            aria-label={`Escuchar voz de ${name}`}
            controls
            preload="none"
            className="w-full"
            src={resolveApiUrl(audio)}
            onError={() => setFailed(true)}
          >
            {captions && (
              <track kind="captions" srcLang="es" label="Español" src={resolveApiUrl(captions)} />
            )}
          </audio>
        ) : (
          <p className="text-sm text-nb-ink-soft">Muestra de voz no disponible.</p>
        )}
        {failed && (
          <p role="status" className="text-sm">
            No se pudo cargar la muestra de voz.
          </p>
        )}
        {sample?.source && <p className="text-xs text-nb-ink-soft">{sample.source}</p>}
        {sample?.text && <p className="text-sm">«{sample.text}»</p>}
      </div>
      {details.poses?.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Poses disponibles ({details.poses.length})
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {details.poses.map((pose) => {
              const url = safeShowcaseUrl(pose.url);
              return url ? (
                <figure key={pose.name} className="overflow-hidden rounded-lg bg-white">
                  {/* biome-ignore lint/performance/noImgElement: recursos de biblioteca autenticados, cargados solo al abrir la ficha. */}
                  <img
                    src={resolveApiUrl(url)}
                    alt={`${name}: ${pose.name}`}
                    loading="lazy"
                    className="aspect-video w-full object-contain"
                  />
                  <figcaption className="p-1 text-center text-xs">{pose.name}</figcaption>
                </figure>
              ) : null;
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
