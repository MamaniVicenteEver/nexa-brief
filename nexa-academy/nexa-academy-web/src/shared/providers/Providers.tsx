"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRealtimeStatus } from "@/features/realtime";
import { ApiError } from "@/infrastructure/api/api-error";
import { Toaster } from "@/shared/components/ui/sonner";

/** Toast global solo para errores que NO son de validación de campo (422) —
 * esos los maneja el propio formulario con `setError`, para no duplicar feedback. */
function handleGlobalError(error: unknown) {
  if (error instanceof ApiError && error.fieldErrors.length > 0) {
    return;
  }
  toast.error(error instanceof ApiError ? error.message : "Ocurrió un error inesperado");
}

/** Red de seguridad: si el WebSocket se cae y se reconecta, refresca las
 * queries que dependen de eventos en tiempo real (canales, notificaciones,
 * jobs, cola de publicación) por si se perdió algún evento mientras estuvo
 * desconectado. Cada hook (useChannels/useNotifications/useJobStatus/
 * useQueueEntries) ya invalida su propia query con cada evento — esto solo
 * cubre el hueco de una desconexión. */
function RealtimeCacheSync() {
  const queryClient = useQueryClient();
  const isConnected = useRealtimeStatus();
  const wasConnected = useRef(false);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["job-status"] });
      queryClient.invalidateQueries({ queryKey: ["scheduleQueue"] });
    }
    wasConnected.current = isConnected;
  }, [isConnected, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleGlobalError }),
        mutationCache: new MutationCache({ onError: handleGlobalError }),
        defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <RealtimeCacheSync />
        {children}
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </SessionProvider>
  );
}
