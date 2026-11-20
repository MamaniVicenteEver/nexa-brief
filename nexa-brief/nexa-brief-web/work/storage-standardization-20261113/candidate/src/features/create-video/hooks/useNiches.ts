import { useQuery } from "@tanstack/react-query";
import { getNiches } from "../api/niches-service";

export function useNiches() {
  return useQuery({
    queryKey: ["niches"],
    queryFn: ({ signal }) => getNiches(signal),
    // Nichos legacy (freeform_html, ej. ambient_music) quedan inactivos en
    // niches.json pero el endpoint los sigue devolviendo — no tiene sentido
    // ofrecerlos para generar un video nuevo.
    select: (niches) => niches.filter((n) => n.active),
  });
}
