"use client";

import { useQuery } from "@tanstack/react-query";
import { resolveAssetFileUrl } from "@/features/library/api/library-assets-service";
import { getPromoDraftResources, type PromoLegacyResource } from "../../api/promo-service";

function resourceFileUrl(id: string, type: string | null) {
	const kind = type === "image" ? "images" : type === "video" ? "videos" : "music";
	return resolveAssetFileUrl(kind, id);
}

function ResourcePreview({ item, index }: { item: PromoLegacyResource; index: number }) {
	const name = item.name || `Recurso visual ${index + 1}`;
	if (!item.id) {
		return <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-nb-bg-2 text-[10px] text-nb-mute">Vista previa no disponible</div>;
	}
	const url = resourceFileUrl(item.id, item.type);
	if (item.type === "image") {
		return <img src={url} alt={name} loading="lazy" className="h-16 w-24 shrink-0 rounded bg-nb-bg-2 object-cover" />;
	}
	if (item.type === "video") {
		return <video src={url} controls playsInline preload="none" aria-label={name} className="h-16 w-24 shrink-0 rounded bg-black object-cover" />;
	}
	return null;
}

/** Ficha en cascada para explorar los recursos del prototipo antes de importarlo a revisión. */
export function PromoLegacyResources({
	draftId,
	onOpenReview,
}: {
	draftId: string;
	onOpenReview: () => void;
}) {
	const query = useQuery({
		queryKey: ["promo-draft-resources", draftId],
		queryFn: ({ signal }) => getPromoDraftResources(draftId, signal),
	});
	if (query.isLoading) return <p role="status" className="mt-2 text-xs text-nb-mute">Cargando canción, recursos y letra…</p>;
	if (query.isError || !query.data) {
		return (
			<p role="status" className="mt-2 text-xs text-nb-mute">
				No se pudieron cargar los recursos.{" "}
				<button type="button" className="font-semibold underline" onClick={() => query.refetch()}>Reintentar</button>
			</p>
		);
	}

	const data = query.data;
	const musicUrl = data.music?.id ? resourceFileUrl(data.music.id, "music") : null;
	return (
		<div className="mt-2 space-y-3 rounded-xl border border-nb-line bg-nb-bg-2 p-3">
			<section className="space-y-2">
				<h5 className="text-xs font-bold">1. Canción y música</h5>
				<div className="rounded-lg border border-nb-line bg-nb-surface p-2">
					<p className="text-xs font-semibold">{data.song.title || data.music?.name || "Canción sin título"}</p>
					{(data.song.artist || data.music?.author) && <p className="mt-0.5 text-[11px] text-nb-mute">{data.song.artist || data.music?.author}</p>}
					{musicUrl ? (
						<audio className="mt-2 w-full" controls preload="none" src={musicUrl} aria-label={`Audio: ${data.music?.name || data.song.title || "música de la promo"}`} />
					) : (
						<p className="mt-1 text-[11px] text-nb-mute">No se encontró un archivo de audio asociado.</p>
					)}
				</div>
			</section>

			<section className="space-y-2">
				<div>
					<h5 className="text-xs font-bold">2. Imágenes y videos</h5>
					<p className="text-[10px] text-nb-mute">Orden definido por el proyecto; las posiciones muestran dónde se reutiliza cada recurso.</p>
				</div>
				{data.media.length ? (
					<ol className="space-y-2">
						{data.media.map((item, index) => {
							const uses = item.scene_uses ?? [];
							const kind = item.type === "video" ? "Video" : item.type === "image" ? "Imagen" : "Recurso";
							const scenes = uses.map((use) => `Escena ${use.scene}`).join(", ");
							const positions = (item.positions ?? []).map((position) => `#${position}`).join(", ");
							return (
								<li key={`${item.id ?? "unknown"}-${index}`} className="flex min-w-0 gap-2 rounded-lg border border-nb-line bg-nb-surface p-2">
									<ResourcePreview item={item} index={index} />
									<div className="min-w-0 flex-1">
										<p className="text-[10px] font-semibold text-nb-mute">{index + 1} · {kind}{positions ? ` · posiciones ${positions}` : scenes ? ` · ${scenes}` : ""}</p>
										<p className="break-words text-xs font-semibold">{item.name || `Recurso ${index + 1}`}</p>
										{(item.author || item.source || item.license) && <p className="mt-0.5 break-words text-[10px] text-nb-mute">{[item.author, item.source, item.license].filter(Boolean).join(" · ")}</p>}
									</div>
								</li>
							);
						})}
					</ol>
				) : (
					<p className="text-xs text-nb-mute">No hay recursos visuales asociados.</p>
				)}
			</section>

			<section className="space-y-2">
				<div>
					<h5 className="text-xs font-bold">3. Letra y textos</h5>
					<p className="text-[10px] text-nb-mute">Texto usado en las escenas del video.</p>
				</div>
				{data.lyrics?.segments.length ? (
					<ol className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-nb-line bg-nb-surface p-2">
						{data.lyrics.segments.map((segment, index) => (
							<li key={`${segment.n ?? index}-${index}`} className="text-xs">
								<span className="mr-1 text-[10px] text-nb-mute">Escena {segment.n || index + 1}{segment.scene ? ` · ${segment.scene}` : ""}</span>
								{segment.lines.join(" · ")}
							</li>
						))}
					</ol>
				) : (
					<p className="text-xs text-nb-mute">La letra no está disponible para este prototipo.</p>
				)}
			</section>

			<p className="text-[10px] leading-relaxed text-nb-mute">Para cambiar un recurso o pedir más, abre la revisión y usa «Sugerir cambios».</p>
			<button type="button" className="w-full rounded-lg border border-nb-line px-3 py-2 text-xs font-semibold" onClick={onOpenReview}>Abrir preparación y revisión</button>
		</div>
	);
}
