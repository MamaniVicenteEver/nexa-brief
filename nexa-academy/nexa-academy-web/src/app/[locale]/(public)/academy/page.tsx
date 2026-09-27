import { setRequestLocale } from "next-intl/server";
import { AcademyWorkspace } from "@/features/academy";

export default async function AcademyWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AcademyWorkspace />;
}
