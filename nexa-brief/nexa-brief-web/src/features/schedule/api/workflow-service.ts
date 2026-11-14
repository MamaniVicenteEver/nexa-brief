import { httpClient } from "@/infrastructure/api/http-client";

export interface WorkflowTarget {
  platform: string;
  account_alias: string;
  format: string;
}
export interface ScheduleWorkflow {
  workflow_id: string;
  video_id: string;
  production_id?: string | null;
  category_path: string;
  topic: string;
  design: string;
  prepare_at?: string | null;
  record_at?: string | null;
  publish_at?: string | null;
  timezone: string;
  formats: string[];
  targets: WorkflowTarget[];
  privacy: string;
  state: string;
  record_state: string;
  publish_state: string;
  error?: string | null;
  record_job_id?: string | null;
  record_started_at?: string | null;
  record_finished_at?: string | null;
  scheduled_job_id?: string | null;
  queue_entry_ids?: string[];
}
export interface WorkflowInput {
  request_id: string;
  video_id?: string;
  preparation?: {
    category_path: string;
    design: string;
    character_id?: string;
    topic: string;
    description: string;
    agent: string;
    minutes: number;
    short_test: boolean;
  };
  prepare_at?: string;
  record_at?: string;
  publish_at?: string;
  timezone: string;
  formats: string[];
  targets: WorkflowTarget[];
  privacy: string;
}
const PATH = "/api/v1/schedule/workflows";
export const getWorkflows = (signal?: AbortSignal) =>
  httpClient<ScheduleWorkflow[]>(PATH, { signal });
export const createWorkflow = (input: WorkflowInput) =>
  httpClient<ScheduleWorkflow>(PATH, { method: "POST", body: input, timeoutMs: 30_000 });
export const updateWorkflow = (
  id: string,
  input: {
    privacy?: string;
    targets?: WorkflowTarget[];
    record_at?: string;
    publish_at?: string;
    cancel?: boolean;
    resume?: boolean;
  },
) =>
  httpClient<ScheduleWorkflow>(`${PATH}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
    timeoutMs: 30_000,
  });

/** These controls explicitly use Bolivia, independent of the computer's zone. */
export function boliviaLocal(ms = Date.now()): string {
  return new Date(ms - 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function boliviaInstant(value: string): string {
  return `${value}:00-04:00`;
}
