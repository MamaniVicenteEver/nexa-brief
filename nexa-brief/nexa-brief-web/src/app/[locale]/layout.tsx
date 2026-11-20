import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { nbBrand, nbCode, nbEditorial, nbSans, nbTech } from "@/lib/fonts";
import { Providers } from "@/shared/providers/Providers";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "Nexa Brief",
  description: "Panel de control para una fábrica de videos musicales automatizada con IA.",
};

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
      className={`${nbSans.variable} ${nbTech.variable} ${nbEditorial.variable} ${nbCode.variable} ${nbBrand.variable} h-full antialiased`}
    >
      <body className="nb-body-bg min-h-full flex flex-col font-nb-sans text-nb-ink">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
