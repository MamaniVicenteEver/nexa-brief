import localFont from "next/font/local";

// Keep the Latin variable fonts local so Docker builds do not depend on Google Fonts.
export const nbSans = localFont({
  src: "./font-assets/inter.woff2",
  variable: "--font-nb-sans",
  weight: "300 900",
});
export const nbTech = localFont({
  src: "./font-assets/space.woff2",
  variable: "--font-nb-tech",
  weight: "500 700",
});
export const nbEditorial = localFont({
  src: "./font-assets/fraunces.woff2",
  variable: "--font-nb-editorial",
  weight: "500 600",
  style: "italic",
});
export const nbBrand = localFont({
  src: "./font-assets/outfit.woff2",
  variable: "--font-nb-brand",
  weight: "600 700",
});
export const nbCode = localFont({
  src: "./font-assets/jetbrains.woff2",
  variable: "--font-nb-code",
  weight: "500 700",
});
