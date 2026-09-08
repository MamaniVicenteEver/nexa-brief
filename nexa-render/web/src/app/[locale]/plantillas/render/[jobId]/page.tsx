import { notFound } from "next/navigation";
import { getRenderStudio } from "@/features/gallery/api/render-studio";
import { EngineBadge } from "@/features/templates/components/EngineBadge";
import { RenderEditor } from "@/features/templates/components/RenderEditor";
import { ApiError } from "@/infrastructure/api/api-error";

export default async function RenderStudioPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const render = await getRenderStudio(jobId).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!render) notFound();

  return (
    <div className="nr-page nr-template-detail-page mx-auto w-full max-w-[1800px] px-4 lg:px-8">
      <EngineBadge engine={render.engine} implemented />
      <h1 className="mt-4 mb-2 text-4xl tracking-[-0.02em]">Abrir en estudio</h1>
      <p className="mb-8 max-w-[640px] text-nr-mute leading-relaxed">Editá esta composición y grabá una nueva versión. El render original queda intacto.</p>
      <RenderEditor layout="studio" template={{
        slug: render.jobId,
        engine: render.engine,
        engineImplemented: true,
        title: "Render guardado",
        description: "",
        input: render.input,
      }} />
    </div>
  );
}
