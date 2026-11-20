export type HistoryStatus = "started" | "completed" | "failed";

export interface HistoryEvent {
  eventId: string;
  jobId: string;
  stage: string;
  status: HistoryStatus;
  message: string | null;
  createdAt: string;
}

export interface JobTimeline {
  jobId: string;
  events: HistoryEvent[];
}
