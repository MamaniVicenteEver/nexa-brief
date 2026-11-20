import type {
  AssetPatch,
  EnrichMusicResult,
  LibraryAsset,
  LibraryAssetKind,
  LibraryAssetPage,
  LibraryPageParams,
  LibrarySearchParams,
  Lyrics,
  MusicGroupPage,
  MusicGroupPageParams,
  UploadAssetInput,
  UploadAssetResult,
} from "../domain/library-assets";

/** Contrato de Recursos. HTTP y los DTO del backend quedan en el adaptador. */
export interface LibraryAssetsPort {
  list(
    kind: LibraryAssetKind,
    signal?: AbortSignal,
    params?: LibrarySearchParams,
  ): Promise<LibraryAsset[]>;
  page(
    kind: LibraryAssetKind,
    params?: LibraryPageParams,
    signal?: AbortSignal,
  ): Promise<LibraryAssetPage>;
  musicGroupsPage(params?: MusicGroupPageParams, signal?: AbortSignal): Promise<MusicGroupPage>;
  get(kind: LibraryAssetKind, assetId: string, signal?: AbortSignal): Promise<LibraryAsset>;
  categories(kind: LibraryAssetKind, signal?: AbortSignal): Promise<string[]>;
  upload(
    kind: LibraryAssetKind,
    input: UploadAssetInput,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<UploadAssetResult>;
  update(kind: LibraryAssetKind, assetId: string, patch: AssetPatch): Promise<LibraryAsset>;
  remove(kind: LibraryAssetKind, assetId: string): Promise<void>;
  lyrics(assetId: string, signal?: AbortSignal): Promise<Lyrics>;
  retranscribe(assetId: string, language?: string): Promise<LibraryAsset>;
  enrichMusic(assetId: string, overwrite?: boolean): Promise<EnrichMusicResult>;
  fileUrl(kind: LibraryAssetKind, assetId: string): string;
  previewUrl(kind: LibraryAssetKind, assetId: string): string;
}
