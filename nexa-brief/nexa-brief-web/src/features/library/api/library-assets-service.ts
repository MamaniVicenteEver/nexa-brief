import { httpLibraryAssetsAdapter } from "../adapters/http-library-assets";
import type { LibraryAssetsPort } from "../ports/library-assets-port";

export type * from "../domain/library-assets";

// Composición: cambiar el proveedor aquí no cambia componentes ni hooks.
const resources: LibraryAssetsPort = httpLibraryAssetsAdapter;
export const getLibraryAssets = resources.list.bind(resources);
export const getLibraryPage = resources.page.bind(resources);
export const getMusicGroupsPage = resources.musicGroupsPage.bind(resources);
export const getLibraryAsset = resources.get.bind(resources);
export const getLibraryCategories = resources.categories.bind(resources);
export const uploadLibraryAsset = resources.upload.bind(resources);
export const updateLibraryAsset = resources.update.bind(resources);
export const deleteLibraryAsset = resources.remove.bind(resources);
export const getLyrics = resources.lyrics.bind(resources);
export const retranscribe = resources.retranscribe.bind(resources);
export const enrichLibraryMusic = resources.enrichMusic.bind(resources);
export const resolveAssetFileUrl = resources.fileUrl.bind(resources);

export const resolveAssetPreviewUrl = resources.previewUrl.bind(resources);
