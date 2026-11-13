import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface TrackedRecording {
  jobId: string;
  videoId: string;
  title: string;
}

interface RecordingTrayState {
  recordings: TrackedRecording[];
  addRecording: (recording: TrackedRecording) => void;
  removeRecording: (jobId: string) => void;
}

export const useRecordingTrayStore = create<RecordingTrayState>()(
  persist(
    (set) => ({
      recordings: [],
      addRecording: (recording) =>
        set((state) => ({
          recordings: [
            ...state.recordings.filter((r) => r.jobId !== recording.jobId),
            recording,
          ].slice(-20),
        })),
      removeRecording: (jobId) =>
        set((state) => ({ recordings: state.recordings.filter((r) => r.jobId !== jobId) })),
    }),
    {
      name: "nexa-explainer-recordings",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
);
