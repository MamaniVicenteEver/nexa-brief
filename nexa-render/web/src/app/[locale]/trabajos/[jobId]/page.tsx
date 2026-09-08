import { getTranslations } from "next-intl/server";
import { JobStatusView } from "@/features/jobs/components/JobStatusView";

export default async function TrabajoPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const t = await getTranslations("jobStatus");

  return (
    <div className="nr-page nr-job-page mx-auto max-w-3xl px-6">
      <span className="label">Job {jobId}</span>
      <h1 className="mt-3 mb-6 text-[32px] tracking-[-0.02em]">{t("title")}</h1>
      <JobStatusView jobId={jobId} />
    </div>
  );
}
