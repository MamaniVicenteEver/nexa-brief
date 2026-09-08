import { notFound } from "next/navigation";
import { getTemplateDetail } from "@/features/templates/api/templates";
import { EngineBadge } from "@/features/templates/components/EngineBadge";
import { RenderEditor } from "@/features/templates/components/RenderEditor";
import { ApiError } from "@/infrastructure/api/api-error";

export default async function PlantillaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const template = await getTemplateDetail(slug).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });

  if (!template) notFound();

  return (
    <div className="nr-page nr-template-detail-page mx-auto max-w-6xl px-6">
      <EngineBadge engine={template.engine} implemented={template.engineImplemented} />
      <h1 className="mt-4 mb-2 text-4xl tracking-[-0.02em]">{template.title}</h1>
      <p className="mb-8 max-w-[640px] text-nr-mute leading-relaxed">{template.description}</p>

      <RenderEditor template={template} />
    </div>
  );
}
