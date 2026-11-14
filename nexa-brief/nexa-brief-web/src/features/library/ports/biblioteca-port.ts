import type { BibliotecaPage, LibraryQuery } from "../domain/biblioteca";

export interface BibliotecaPort {
  page(query: LibraryQuery, signal?: AbortSignal): Promise<BibliotecaPage>;
}
