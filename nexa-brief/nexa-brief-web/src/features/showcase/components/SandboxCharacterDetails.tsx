"use client";

import { useEffect, useState } from "react";
import {
  type CatalogSprite,
  catalogFileUrl,
  prototypeFileUrl,
  type SandboxCatalog,
} from "../lib/sandbox-catalog";

type Character = {
  id?: string;
  name?: string;
  tema?: string;
  objetivo?: string;
  publico?: string;
  personalidad?: string[];
  estilo?: string;
  apariencia?: string;
  idioma?: string;
  voz?: {
    nombre?: string;
    modelo?: string;
    direccion?: string;
    estado?: string;
    aprobada?: boolean;
  };
  voice?: string;
  seed?: number;
  height?: number;
  skin?: string;
  head?: { radius?: number; roundness?: number };
  hair?: { style?: string; color?: string };
  outfit?: { style?: string; color?: string };
  shoes?: { style?: string; color?: string };
  face?: { expression?: string };
  accessories?: Record<string, unknown>;
};
type Voice = {
  id?: string;
  voice?: string;
  model?: string;
  language?: string;
  direction?: string;
  pace?: number;
  approved?: boolean;
};
type Details = {
  character: Character | null;
  voice: Voice | null;
  loading: boolean;
  error: string | null;
  voiceError: boolean;
};

export function useCharacterDetails(
  path: string,
  catalog: SandboxCatalog,
  item: CatalogSprite,
): Details {
  const [details, setDetails] = useState<Details>({
    character: null,
    voice: null,
    loading: true,
    error: null,
    voiceError: false,
  });
  useEffect(() => {
    if (!item.characterFile) return;
    const controller = new AbortController();
    setDetails({ character: null, voice: null, loading: true, error: null, voiceError: false });
    const load = async () => {
      try {
        const response = await fetch(catalogFileUrl(path, catalog, item.characterFile!), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("No se pudo cargar la ficha del personaje.");
        const character: Character = await response.json();
        let voice: Voice | null = null;
        let voiceError = false;
        if (character.voz) {
          voice = {
            voice: character.voz.nombre,
            model: character.voz.modelo,
            direction: character.voz.direccion,
            language: character.idioma,
            approved:
              character.voz.aprobada ?? character.voz.estado === "perfil_existente_aprobado",
          };
        } else if (character.voice && /^[a-z][a-z0-9-]*$/.test(character.voice)) {
          try {
            const res = await fetch(
              catalogFileUrl(path, catalog, `voices/${character.voice}.json`),
              { signal: controller.signal },
            );
            if (!res.ok) throw new Error("Perfil de voz no disponible");
            voice = await res.json();
          } catch (error) {
            if (controller.signal.aborted) return;
            voiceError = true;
          }
        } else if (character.voice) voiceError = true;
        if (!controller.signal.aborted)
          setDetails({ character, voice, loading: false, error: null, voiceError });
      } catch {
        if (!controller.signal.aborted)
          setDetails({
            character: null,
            voice: null,
            loading: false,
            error: "No se pudo cargar la ficha del personaje.",
            voiceError: false,
          });
      }
    };
    void load();
    return () => controller.abort();
  }, [path, catalog, item.characterFile]);
  return details;
}

export function CharacterVoice({ item, details }: { item: CatalogSprite; details: Details }) {
  const [failed, setFailed] = useState(false);
  return (
    <section
      aria-label={`Voz de ${item.name}`}
      className="shrink-0 space-y-1 rounded-2xl bg-nb-surface p-3 text-nb-ink"
    >
      <h3 className="font-semibold">Voz del personaje</h3>
      {details.loading ? (
        <p role="status">Cargando perfil de voz…</p>
      ) : (
        <>
          {item.voiceSample ? (
            <>
              {item.voiceSample.captions ? (
                <audio
                  aria-label={`Escuchar voz de ${item.name}`}
                  controls
                  preload="none"
                  className="w-full"
                  src={prototypeFileUrl("sandbox", item.voiceSample.file.slice("sandbox/".length))}
                  onError={() => setFailed(true)}
                >
                  <track
                    kind="captions"
                    srcLang="es"
                    label="Español"
                    src={prototypeFileUrl(
                      "sandbox",
                      item.voiceSample.captions.slice("sandbox/".length),
                    )}
                  />
                </audio>
              ) : (
                // biome-ignore lint/a11y/useMediaCaption: las muestras anteriores incluyen su transcripción bajo el reproductor.
                <audio
                  aria-label={`Escuchar voz de ${item.name}`}
                  controls
                  preload="none"
                  className="w-full"
                  src={prototypeFileUrl("sandbox", item.voiceSample.file.slice("sandbox/".length))}
                  onError={() => setFailed(true)}
                />
              )}
              {failed && (
                <p role="status" className="text-sm">
                  No se pudo cargar la muestra de voz.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm">Aún no hay una muestra de voz disponible.</p>
          )}
          {details.voice ? (
            <p className="text-sm">
              {details.voice.voice || details.character?.voice} ·{" "}
              {details.voice.language || "Idioma sin definir"} ·{" "}
              {details.voice.approved ? "Aprobada" : "Pendiente de aprobación"}
            </p>
          ) : (
            <p className="text-sm">
              {details.voiceError
                ? "No se pudo cargar el perfil de voz."
                : "Perfil de voz no disponible."}
            </p>
          )}
          {item.voiceSample?.source && <p className="text-xs">{item.voiceSample.source}</p>}
          {item.voiceSample?.text && <p className="text-sm">«{item.voiceSample.text}»</p>}
        </>
      )}
    </section>
  );
}

export function CharacterTechnical({ details }: { details: Details }) {
  const c = details.character;
  const v = details.voice;
  const rows: [string, unknown][] = c
    ? [
        ["Identificador", c.id],
        ["Tema", c.tema],
        ["Objetivo", c.objetivo],
        ["Público", c.publico],
        ["Personalidad", c.personalidad?.join(", ")],
        ["Estilo", c.estilo],
        ["Apariencia", c.apariencia],
        ["Altura relativa", c.height],
        ["Semilla", c.seed],
        ["Piel", c.skin],
        [
          "Cabeza (radio / redondez)",
          c.head && `${c.head.radius ?? "—"} / ${c.head.roundness ?? "—"}`,
        ],
        ["Cabello", c.hair && `${c.hair.style ?? "—"} · ${c.hair.color ?? "—"}`],
        ["Vestuario", c.outfit && `${c.outfit.style ?? "—"} · ${c.outfit.color ?? "—"}`],
        ["Calzado", c.shoes && `${c.shoes.style ?? "—"} · ${c.shoes.color ?? "—"}`],
        ["Expresión inicial", c.face?.expression],
        [
          "Accesorios",
          c.accessories && Object.keys(c.accessories).length
            ? JSON.stringify(c.accessories)
            : "Ninguno",
        ],
        ["Perfil de voz", c.voice],
        ["Voz", v?.voice],
        ["Modelo", v?.model],
        ["Idioma", v?.language],
        ["Ritmo objetivo", v?.pace && `${v.pace} palabras/min`],
      ]
    : [];
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Información técnica</h3>
      {details.loading ? (
        <p role="status">Cargando ficha…</p>
      ) : details.error ? (
        <p role="status">{details.error}</p>
      ) : (
        <>
          <dl className="space-y-3 break-words">
            {rows
              .filter(([, value]) => value !== undefined && value !== null)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold">{label}</dt>
                  <dd className="font-mono text-sm">{String(value)}</dd>
                </div>
              ))}
          </dl>
          {v?.direction && (
            <div>
              <h4 className="text-xs font-semibold">Dirección de voz</h4>
              <p className="text-sm">{v.direction}</p>
            </div>
          )}
          {details.voiceError && (
            <p role="status" className="text-sm">
              Perfil de voz no disponible.
            </p>
          )}
        </>
      )}
    </section>
  );
}
