"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getDesignGroups } from "@/features/explainer/api/explainer-service";
import { SandboxPrototypePlayer } from "./SandboxPrototypePlayer";

/** Usa la demo asociada por el catálogo del servidor, que puede no ser el video de origen. */
export function ProductionPrototype({
  designId,
  format,
}: {
  designId: string | null;
  format: string;
}) {
  const [open, setOpen] = useState(false);
  const groups = useQuery({
    queryKey: ["showcase", "design-groups"],
    queryFn: ({ signal }) => getDesignGroups("", signal),
    enabled: !!designId,
  });
  if (!designId) return <p>Selecciona un diseño para ver su video de referencia.</p>;
  if (groups.isPending) return <p role="status">Buscando video de referencia…</p>;
  if (groups.isError) return <p role="alert">No se pudo cargar el video de referencia.</p>;
  const design = groups.data
    .flatMap((group) => group.designs)
    .find((item) => item.designId === designId);
  if (!design?.previewUrl)
    return <p>Este diseño aún no tiene un video de referencia disponible.</p>;
  const url = new URL(design.previewUrl, window.location.href);
  url.searchParams.set("controls", "1");
  return (
    <div className="max-w-3xl space-y-3 rounded-2xl border border-nb-line bg-nb-surface p-4">
      <h2 className="font-semibold">Video de referencia · {design.name}</h2>
      {!open ? (
        <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-xl bg-black">
          {design.posterUrl && (
            // biome-ignore lint/performance/noImgElement: la portada protegida usa la sesión del navegador.
            <img
              src={design.posterUrl}
              alt=""
              className="absolute h-full w-full object-contain opacity-70"
            />
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative rounded-lg bg-white px-4 py-2 text-black"
          >
            Ver prototipo
          </button>
        </div>
      ) : (
        <SandboxPrototypePlayer
          load={() => Promise.resolve(url.toString())}
          title={design.name}
          format={format}
        />
      )}
    </div>
  );
}
