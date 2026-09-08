"use client";

import { useEffect, useState } from "react";
import { useJobsTrayStore } from "@/shared/store";
import { JobProgressCard } from "./JobProgressCard";

function CloseIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, parent button has aria-label
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-3"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Fixed bottom-right stack of in-flight/recent job cards — mounted once in
 * `(admin)/layout.tsx`, so it stays visible across every admin page instead
 * of disappearing the moment you navigate away from wherever you submitted
 * the batch. Both submission entry points (CreateVideoForm and
 * TemplateRecordButton) push into the same `useJobsTrayStore`. */
export function JobsTray() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const jobs = useJobsTrayStore((state) => state.jobs);
  const removeJob = useJobsTrayStore((state) => state.removeJob);

  useEffect(() => {
    useJobsTrayStore.persist.rehydrate();
    setHasHydrated(true);
  }, []);

  if (!hasHydrated || jobs.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex max-h-[75vh] w-[320px] flex-col-reverse gap-2 overflow-x-hidden overflow-y-auto">
      {jobs.map((job) => (
        <div key={job.jobId} className="relative shrink-0">
          <button
            type="button"
            onClick={() => removeJob(job.jobId)}
            aria-label="Cerrar"
            className="absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full bg-nb-ink/70 text-white hover:bg-nb-ink"
          >
            <CloseIcon />
          </button>
          <JobProgressCard job={{ jobId: job.jobId, category: job.category, stage: "pending" }} />
        </div>
      ))}
    </div>
  );
}
