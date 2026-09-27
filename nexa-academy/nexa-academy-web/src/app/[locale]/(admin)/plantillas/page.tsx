import { redirect } from "@/i18n/navigation";

export default async function PlantillasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/academy", locale });
}
