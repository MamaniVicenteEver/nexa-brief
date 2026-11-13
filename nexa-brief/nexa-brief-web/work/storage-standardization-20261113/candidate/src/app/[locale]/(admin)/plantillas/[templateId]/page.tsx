import { TemplateDetailView } from "@/features/templates";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateDetailView templateId={templateId} />;
}
