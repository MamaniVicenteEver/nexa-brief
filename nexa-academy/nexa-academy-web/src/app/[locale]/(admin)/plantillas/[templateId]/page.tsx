import { redirect } from "@/i18n/navigation";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; templateId: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/academy", locale });
}
