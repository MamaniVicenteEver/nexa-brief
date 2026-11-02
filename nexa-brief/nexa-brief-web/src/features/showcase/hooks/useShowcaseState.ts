"use client";

import { useEffect, useState } from "react";
import { resolveSelection } from "../lib/filters";
import { DEFAULT_FORMAT, isFormatId } from "../lib/formats";
import type { Design, FormatId, Selection } from "../types";

export function useShowcaseState(designs: Design[]) {
  const [storedSelection, setStoredSelection] = useState<Selection>({ kind: "design", id: "" });
  const [format, updateFormat] = useState<FormatId>(DEFAULT_FORMAT);
  const [query, setQuery] = useState("");
  const [restored, setRestored] = useState(false);
  const selection = resolveSelection(storedSelection, designs);

  useEffect(() => {
    // Leer cada preferencia por separado: un fallo no impide restaurar la otra.
    try {
      const saved = window.localStorage.getItem("kit.design");
      if (saved)
        setStoredSelection(saved === "videos" ? { kind: "videos" } : { kind: "design", id: saved });
    } catch {
      /* El almacenamiento puede estar bloqueado. */
    }
    try {
      const saved = window.localStorage.getItem("kit.orient");
      if (isFormatId(saved)) updateFormat(saved);
    } catch {
      /* La preferencia mantiene su valor por defecto. */
    }
    setRestored(true);
  }, []);

  const selectionValue = selection.kind === "videos" ? "videos" : selection.id;
  useEffect(() => {
    if (!restored) return;
    // No reemplazar un diseño guardado mientras el índice todavía está cargando.
    if (selectionValue) {
      try {
        window.localStorage.setItem("kit.design", selectionValue);
      } catch {
        /* Opcional. */
      }
    }
    try {
      window.localStorage.setItem("kit.orient", format);
    } catch {
      /* Opcional. */
    }
  }, [selectionValue, format, restored]);

  function setSelection(value: Selection) {
    setStoredSelection(resolveSelection(value, designs));
  }

  function setFormat(value: FormatId) {
    if (isFormatId(value)) updateFormat(value);
  }

  return { selection, setSelection, query, setQuery, format, setFormat };
}
