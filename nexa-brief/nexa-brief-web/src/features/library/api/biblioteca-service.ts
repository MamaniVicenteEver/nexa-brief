import { httpBibliotecaAdapter } from "../adapters/http-biblioteca";
import type { BibliotecaPort } from "../ports/biblioteca-port";

const biblioteca: BibliotecaPort = httpBibliotecaAdapter;
export const getBibliotecaPage = biblioteca.page.bind(biblioteca);
