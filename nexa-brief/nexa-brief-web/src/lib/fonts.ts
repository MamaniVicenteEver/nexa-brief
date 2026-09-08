import { Fraunces, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

/**
 * Nexa Brief (Monax) type system — DESIGN-SYSTEM.md §3.
 * Self-hosted via next/font/google: no external <link> request at
 * runtime (the prototype loaded these from a Google Fonts CDN link tag).
 */

export const nbSans = Inter({
  variable: "--font-nb-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const nbTech = Space_Grotesk({
  variable: "--font-nb-tech",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const nbEditorial = Fraunces({
  variable: "--font-nb-editorial",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic"],
});

export const nbCode = JetBrains_Mono({
  variable: "--font-nb-code",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
