import { VideoDetailView } from "@/features/library";

export default async function VideoDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <VideoDetailView jobId={jobId} />;
}
