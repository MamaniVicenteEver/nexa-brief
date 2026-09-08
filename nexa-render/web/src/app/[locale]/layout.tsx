import type { Metadata } from "next";
import { Archivo, Caveat, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Footer } from "@/shared/components/layout/Footer";
import { Nav } from "@/shared/components/layout/Nav";
import { Providers } from "@/shared/providers/Providers";
import "../globals.css";

const nrArchivo = Archivo({
  subsets: ["latin"],
  variable: "--font-nr-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});
const nrJetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-nr-jetbrains",
  weight: ["500", "600", "700"],
});
const nrCaveat = Caveat({
  subsets: ["latin"],
  variable: "--font-nr-caveat",
  weight: ["600"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${nrArchivo.variable} ${nrJetbrains.variable} ${nrCaveat.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Nav />
            <main data-main>{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
