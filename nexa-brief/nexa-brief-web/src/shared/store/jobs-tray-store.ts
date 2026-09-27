import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Minimal identity only — no `stage` here on purpose. Stage is volatile and
 * already tracked live per-job via `useJobStatus` (react-query + the
 * realtime WebSocket, see `@/features/realtime`) the moment a card mounts;
 * persisting a stage snapshot here would just go stale between renders. */
export interface TrackedJob {
  jobId: string;
  category: string;
}

const MAX_TRACKED_JOBS = 20;

interface JobsTrayState {
  jobs: TrackedJob[];
  addJobs: (jobs: TrackedJob[]) => void;
  removeJobs: (jobIds: string[]) => void;
}

/** Survives navigating between admin pages (sessionStorage — same tab only,
 * clears when it closes), so submitting a batch from "Crear video" or from
 * a template's "record" button keeps showing progress no matter which page
 * you're on afterward. See `JobsTray.tsx` (the one place this is read) and
 * `(admin)/layout.tsx` (the one place it's mounted). */
export const useJobsTrayStore = create<JobsTrayState>()(
  persist(
    (set) => ({
      jobs: [],
      addJobs: (newJobs) =>
        set((state) => {
          const existingIds = new Set(state.jobs.map((j) => j.jobId));
          const deduped = newJobs.filter((j) => !existingIds.has(j.jobId));
          const combined = [...state.jobs, ...deduped];
          // Drop the oldest once we're over the cap — an old terminal job
          // sitting around forever isn't useful, and keeps sessionStorage
          // (and the number of live useJobStatus subscriptions) bounded.
          return { jobs: combined.slice(-MAX_TRACKED_JOBS) };
        }),
      removeJobs: (jobIds) =>
        set((state) => ({ jobs: state.jobs.filter((j) => !jobIds.includes(j.jobId)) })),
    }),
    {
      name: "nexa-jobs-tray",
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrated manually by JobsTray (see its `hasHydrated` guard) —
      // avoids a flash of "empty tray" on every navigation while zustand's
      // automatic rehydration is still catching up.
      skipHydration: true,
    },
  ),
);
