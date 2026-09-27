/**
 * Offline-safe Nexa type system.
 *
 * The old implementation used next/font/google, which made every production
 * build depend on DNS access to fonts.googleapis.com. These variables keep the
 * same semantic roles while using professional local system fallbacks; a
 * deployment may override them with self-hosted @font-face assets later.
 */
const localFontVariable = (variable: string) => ({ variable });

export const nbSans = localFontVariable("--font-nb-sans");
export const nbTech = localFontVariable("--font-nb-tech");
export const nbEditorial = localFontVariable("--font-nb-editorial");
export const nbCode = localFontVariable("--font-nb-code");
