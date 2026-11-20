"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLibraryAsset, type LibraryAsset } from "@/features/library/api/library-assets-service";
import { libraryAssetsKey } from "@/features/library/hooks/useLibraryAssets";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import {
  createDraft,
  deleteDraft,
  prepareDraft,
  renameDraft,
  saveDraftDetails,
} from "../api/studio-service";
import {
  buildDraftRequest,
  isStudioValueComplete,
  studioValueFromDraft,
  studioValueSignature,
} from "../lib/draft-request";
import {
  hydrateSongMetadataTextFields,
  resetSongMetadataTextFields,
  updateSongMetadataTextFields,
} from "../lib/song-text-fields";
import {
  backgroundVisibility,
  supportsBackgroundVisibility,
} from "../services/background-visibility";
import { type Draft, type DraftDetails, EMPTY_STUDIO_VALUE, type StudioValue } from "../types";
import { draftKey, draftsKey, isDraftRunning, useDraft } from "./useDraft";
import { prototypeLabel } from "./useRecordPrototype";

/** Qué toca hacer con el prototipo: previsualizar → preparar → (detalles / grabar). */
export type PrototypeStep = "preview" | "prepare" | "prepared" | "busy" | "rendered";

function stepOf(draft: Draft | null, dirty: boolean, running: boolean): PrototypeStep {
  if (running) return "busy";
  if (!draft || dirty) return "preview";
  switch (draft.status) {
    case "preview_ready":
      return "prepare";
    case "prepared":
      return "prepared";
    case "rendered":
      return "rendered";
    case "failed":
      if (!draft.recoverable) return "preview";
      return draft.details ? "prepared" : "prepare";
    default:
      return "busy";
  }
}

/** Un prototipo del Sandbox: lo elegido (canción, medios, textos), su draft y las acciones.
 * `draftId` null = prototipo nuevo (todavía sin carpeta: se crea al previsualizar). */
export function usePrototypeEditor({
  template,
  requirements,
  draftId,
  sessionKey = draftId ?? "legacy:new",
  initialResourcesDraft = null,
  initialResourcesReady = true,
  onCreated,
}: {
  template: Template;
  requirements: TemplateRequirements | undefined;
  draftId: string | null;
  /** Identifica cada apertura del editor; "new" puede abrirse varias veces sin crear draft. */
  sessionKey?: string | null;
  /** El video original conserva los medios predeterminados que se pueden reutilizar. */
  initialResourcesDraft?: Draft | null;
  initialResourcesReady?: boolean;
  defaultName: string;
  onCreated: (draftId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: songs } = useLibraryList("music");
  const draft = useDraft(draftId).data ?? null;
  const [value, setValue] = useState<StudioValue>(EMPTY_STUDIO_VALUE);
  const [baseSignature, setBaseSignature] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [songNotes, setSongNotes] = useState("");
  const [songMetadataLoading, setSongMetadataLoading] = useState(false);
  const [songMetadataError, setSongMetadataError] = useState<Error | null>(null);
  const loadedFor = useRef<string | null>(null);
  const songMetadataRequest = useRef(0);

  // Al abrir un prototipo se carga lo que tenía elegido (una sola vez por prototipo).
  useEffect(() => {
    if (!requirements || !sessionKey) return;
    if (loadedFor.current === sessionKey) return;
    songMetadataRequest.current += 1;
    setSongMetadataLoading(false);
    setSongMetadataError(null);
    if (draftId === null) {
      if (!initialResourcesReady) return;
      loadedFor.current = sessionKey;
      const restored = initialResourcesDraft
        ? studioValueFromDraft(initialResourcesDraft, requirements)
        : EMPTY_STUDIO_VALUE;
      const initial: StudioValue = {
        ...EMPTY_STUDIO_VALUE,
        media: {
          ...Object.fromEntries(
            Object.entries(requirements.defaults?.media ?? {}).filter(([slot]) =>
              requirements.media.some((requirement) => requirement.slot === slot),
            ),
          ),
          ...restored.media,
        },
        texts: Object.fromEntries(
          requirements.texts.map((field) => [field.key, field.default ?? ""]),
        ),
      };
      // Un prototipo nuevo conserva los medios de la plantilla, pero siempre
      // requiere que la persona elija su propia canción.
      initial.mediaOpacity = supportsBackgroundVisibility(template.id)
        ? {
            ...initial.mediaOpacity,
            background: backgroundVisibility.get(`new:${template.id}`) ?? 0.8,
          }
        : undefined;
      setValue(initial);
      setBaseSignature(null);
      setName("");
      setSongNotes("");
      setSongMetadataLoading(false);
      setSongMetadataError(null);
      return;
    }
    if (!draft) return;
    loadedFor.current = sessionKey;
    const restored = studioValueFromDraft(draft, requirements);
    if (supportsBackgroundVisibility(template.id)) {
      restored.mediaOpacity = {
        ...restored.mediaOpacity,
        background: backgroundVisibility.get(draftId) ?? 0.8,
      };
    }
    setValue(restored);
    setSongNotes(draft.songNotes);
    setSongMetadataLoading(false);
    setSongMetadataError(null);
    setBaseSignature(
      studioValueSignature(template.id, requirements, { ...restored, mediaOpacity: undefined }),
    );
    setName(prototypeLabel(draft, "", songs));
  }, [
    draftId,
    draft,
    requirements,
    template.id,
    songs,
    sessionKey,
    initialResourcesDraft,
    initialResourcesReady,
  ]);

  useEffect(() => {
    if (!draft) return;
    setName((current) =>
      current === draft.name || !current ? prototypeLabel(draft, current, songs) : current,
    );
  }, [draft, songs]);

  // Completa prototipos antiguos que guardaron la canción pero dejaron sus
  // textos vacíos o con los defaults; respeta cualquier edición personalizada.
  useEffect(() => {
    if (!requirements || !sessionKey || loadedFor.current !== sessionKey || !value.musicAssetId) {
      return;
    }
    const song = songs?.find((asset) => asset.assetId === value.musicAssetId);
    if (!song) return;
    setValue((current) => {
      if (current.musicAssetId !== song.assetId) return current;
      const texts = hydrateSongMetadataTextFields(requirements.texts, current.texts, song);
      const unchanged = requirements.texts.every(
        (field) => texts[field.key] === (current.texts[field.key] ?? ""),
      );
      return unchanged ? current : { ...current, texts };
    });
  }, [requirements, sessionKey, songs, value.musicAssetId]);

  const signature = useMemo(
    () =>
      requirements
        ? studioValueSignature(template.id, requirements, { ...value, mediaOpacity: undefined })
        : null,
    [requirements, template.id, value],
  );
  const dirty = draft !== null && signature !== baseSignature;
  const refreshList = () => queryClient.invalidateQueries({ queryKey: draftsKey(template.id) });
  const store = (updated: Draft) => {
    queryClient.setQueryData(draftKey(updated.draftId), updated);
    refreshList();
  };

  const selectSong = (musicAssetId: string | null, selectedSong: LibraryAsset | null = null) => {
    const request = ++songMetadataRequest.current;
    setSongMetadataError(null);
    setSongMetadataLoading(Boolean(musicAssetId));
    setValue((current) => ({
      ...current,
      musicAssetId,
      texts: !requirements
        ? current.texts
        : resetSongMetadataTextFields(
            requirements.texts,
            current.texts,
            musicAssetId ? "empty" : "default",
          ),
    }));
    if (!musicAssetId || !requirements) {
      setSongMetadataLoading(false);
      return;
    }

    const applySong = (song: LibraryAsset) => {
      if (request !== songMetadataRequest.current) return;
      setValue((current) =>
        current.musicAssetId === musicAssetId
          ? {
              ...current,
              texts: updateSongMetadataTextFields(requirements.texts, current.texts, song),
            }
          : current,
      );
      setSongMetadataLoading(false);
    };

    // El selector ya entrega los datos de la canción; no hace falta esperar otra consulta al API.
    const song =
      selectedSong?.assetId === musicAssetId
        ? selectedSong
        : songs?.find((asset) => asset.assetId === musicAssetId);
    if (song) {
      applySong(song);
      return;
    }

    void queryClient
      .fetchQuery({
        queryKey: [...libraryAssetsKey("music"), "item", musicAssetId],
        queryFn: ({ signal }) => getLibraryAsset("music", musicAssetId, signal),
        staleTime: 0,
      })
      .then(applySong)
      .catch((error: unknown) => {
        if (request !== songMetadataRequest.current) return;
        setSongMetadataLoading(false);
        setSongMetadataError(error instanceof Error ? error : new Error(String(error)));
      });
  };

  const preview = useMutation({
    mutationFn: async () => {
      if (!requirements) throw new Error("requirements not loaded");
      const request = buildDraftRequest(template.id, requirements, value);
      if (request.template_inputs) delete request.template_inputs.media_opacity;
      return createDraft({
        ...request,
        name:
          name.trim() || songs?.find((song) => song.assetId === value.musicAssetId)?.title || "",
      });
    },
    onSuccess: async (created) => {
      const replaced = draft;
      const priorKey = draftId ?? `new:${template.id}`;
      const opacity = backgroundVisibility.get(priorKey);
      if (opacity !== null) backgroundVisibility.set(created.draftId, opacity);
      loadedFor.current = created.draftId;
      setBaseSignature(signature);
      store(created);
      onCreated(created.draftId);
      // Volver a previsualizar reemplaza la versión anterior del MISMO prototipo
      // (salvo que ya esté grabada: ese video vive en Biblioteca).
      if (replaced && replaced.status !== "rendered" && !isDraftRunning(replaced)) {
        await deleteDraft(replaced.draftId).catch(() => undefined);
        refreshList();
      }
    },
  });

  const prepare = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("no draft");
      return prepareDraft(draft.draftId, songNotes);
    },
    onSuccess: store,
  });

  const saveDetails = useMutation({
    mutationFn: async (details: DraftDetails) => {
      if (!draft) throw new Error("no draft");
      return saveDraftDetails(draft.draftId, details);
    },
    onSuccess: store,
  });

  const rename = useMutation({
    mutationFn: async (next: string) => {
      if (!draft) throw new Error("no draft");
      return renameDraft(draft.draftId, next);
    },
    onSuccess: store,
  });

  const running = isDraftRunning(draft) || preview.isPending || prepare.isPending;
  return {
    draft,
    value,
    setValue: (next: StudioValue) => {
      if (
        supportsBackgroundVisibility(template.id) &&
        next.mediaOpacity?.background !== value.mediaOpacity?.background &&
        typeof next.mediaOpacity?.background === "number"
      ) {
        backgroundVisibility.set(draftId ?? `new:${template.id}`, next.mediaOpacity.background);
      }
      setValue(next);
    },
    name,
    setName,
    /** «Información de la canción» para Preparar (opcional). */
    songNotes,
    setSongNotes,
    songMetadataLoading,
    initializing: Boolean(
      sessionKey &&
        draftId === null &&
        (!initialResourcesReady || loadedFor.current !== sessionKey),
    ),
    /** Consulta la canción elegida y sincroniza título/artista con los textos de la plantilla. */
    selectSong,
    /** Guarda el nombre (si el prototipo ya tiene carpeta y cambió). */
    commitName: () => {
      const next = name.trim();
      if (draft && next && next !== draft.name) rename.mutate(next);
    },
    dirty,
    complete: requirements ? isStudioValueComplete(requirements, value) : false,
    step: stepOf(draft, dirty, running),
    preview,
    prepare,
    saveDetails,
    error: songMetadataError ?? preview.error ?? prepare.error ?? saveDetails.error ?? rename.error,
  };
}

export type PrototypeEditorController = ReturnType<typeof usePrototypeEditor>;
