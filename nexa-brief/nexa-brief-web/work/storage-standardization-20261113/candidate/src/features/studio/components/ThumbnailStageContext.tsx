"use client";

import { createContext, useContext } from "react";
import type { DraftThumbnailManifest } from "../hooks/useDraftThumbnailEditor";
import type { DraftThumbnailOptionId } from "../types";

export type ThumbnailStagePreview = {
  draftId: string;
  option: DraftThumbnailOptionId;
  manifest: DraftThumbnailManifest;
};
export const ThumbnailStageContext = createContext<{
  preview: ThumbnailStagePreview | null;
  setPreview: (preview: ThumbnailStagePreview | null) => void;
}>({ preview: null, setPreview: () => {} });
export const useThumbnailStage = () => useContext(ThumbnailStageContext);
