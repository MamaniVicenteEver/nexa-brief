"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import type { Draft, DraftThumbnailOptionId } from "../../types";
import {
	getPromoContent,
	type PromoContentAvailability,
	type PromoSession,
} from "../../api/promo-service";

const missing: Record<PromoContentAvailability, string> = {
	available: "Sin información disponible.",
	missing: "Todavía no está disponible.",
	pending: "Se mostrará cuando termine la preparación.",
	stale:
		"La información corresponde a una versión anterior; vuelve a preparar el prototipo.",
};
const platform: Record<string, string> = {
	youtube: "YouTube",
	facebook: "Facebook",
	instagram: "Instagram",
	tiktok: "TikTok",
};
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-2xl border border-nb-line p-3">
			<h4 className="text-xs font-bold text-nb-ink">{title}</h4>
			<div className="mt-2 space-y-2 text-xs text-nb-ink-soft">{children}</div>
		</section>
	);
}

function Thumbnail({ option, url, selected, text }: { option: DraftThumbnailOptionId; url: string; selected: boolean; text?: string }) {
 const [failed, setFailed] = useState(false);
 return <figure className="min-w-0 space-y-1">
  {failed ? <p role="status">Miniatura {option}: no disponible.</p> : <img src={url} alt={`Miniatura ${option}`} loading="lazy" onError={() => setFailed(true)} className="h-auto w-full rounded" />}
  <figcaption>Opción {option}{selected ? " · Seleccionada" : ""}{text ? ` · ${text}` : ""}</figcaption>
 </figure>;
}

/** Ficha de solo lectura del contenido efectivo; no interpreta una propuesta como resultado. */
export function PromoReview({ session, draft }: { session: PromoSession; draft?: Draft }) {
	const content = useQuery({
		queryKey: [
			"promo-content",
			session.session_id,
			session.revision,
			session.draft_id,
		],
		queryFn: ({ signal }) => getPromoContent(session.session_id, signal),
		enabled:
			!!session.draft_id &&
			(session.state === "review" || session.state === "ready"),
	});
	if (!session.draft_id || !["review", "ready"].includes(session.state))
		return (
			<p className="text-xs text-nb-mute">
				El contenido aparecerá cuando esté preparado.
			</p>
		);
	if (content.isLoading)
		return (
			<p className="text-xs text-nb-mute">Cargando contenido del prototipo…</p>
		);
	if (content.isError || !content.data)
		return (
			<p role="status" className="text-xs text-nb-mute">
				No se pudo cargar el contenido.{" "}
				<button
					type="button"
					className="font-semibold underline"
					onClick={() => content.refetch()}
				>
					Reintentar
				</button>
			</p>
		);
	const data = content.data;
	// Never display a response from a previous revision or another draft as current.
	if (data.session_id !== session.session_id || data.revision !== session.revision || data.draft_id !== session.draft_id)
		return (
			<p role="status" className="text-xs text-nb-mute">
				El contenido está actualizándose. Vuelve a cargar la ficha.
			</p>
		);
	const avail = data.availability;
	const copies = Object.entries(avail?.draft === "available" ? data.copies ?? {} : {}).filter(
		([, value]) => value && (value.title || value.description),
	);
	return (
		<div className="space-y-3">
			<Section title="Título">
				<p className="whitespace-pre-wrap font-semibold">
					{(avail?.draft === "available" && data.title) || missing[avail?.draft ?? "missing"]}
				</p>
			</Section>
			<Section title="Brief">
                {avail?.brief === "available" && data.brief ? <dl className="space-y-1">
                  {data.brief.topic && <div><dt className="inline font-semibold">Tema: </dt><dd className="inline">{data.brief.topic}</dd></div>}
                  {data.brief.audience && <div><dt className="inline font-semibold">Público: </dt><dd className="inline">{data.brief.audience}</dd></div>}
                  {data.brief.duration_seconds != null && <div><dt className="inline font-semibold">Duración: </dt><dd className="inline">{data.brief.duration_seconds} segundos</dd></div>}
                  {data.brief.tone && <div><dt className="inline font-semibold">Tono: </dt><dd className="inline">{data.brief.tone}</dd></div>}
                  {data.brief.language && <div><dt className="inline font-semibold">Idioma: </dt><dd className="inline">{data.brief.language}</dd></div>}
                </dl> : <p>{missing[avail?.brief ?? "missing"]}</p>}
            </Section>
            <Section title="Descripciones">
				{copies.length ? (
					copies.map(([key, value]) => (
						<details key={key} className="rounded-lg bg-nb-bg-2 p-2">
							<summary className="cursor-pointer font-semibold">
								{platform[key] ?? key}
							</summary>
							{value?.title && (
								<p className="mt-2 font-semibold">{value.title}</p>
							)}
							{value?.description && (
								<p className="mt-1 whitespace-pre-wrap">{value.description}</p>
							)}
						</details>
					))
				) : (
					<p>{missing[avail?.draft ?? "missing"]}</p>
				)}
			</Section>
			<Section title="Guion / texto en pantalla">
				<p className="text-nb-mute">Diálogo o narración: no disponible.</p>
				{avail?.guion === "available" && data.guion?.segments?.length ? (
					<ol className="space-y-1">
						{data.guion.segments.map((segment, index) => (
							<li key={`${segment.n}-${index}`}>
								<span className="mr-2 text-nb-mute">
									{segment.n || index + 1}.
								</span>
								{(segment.lines ?? []).join(" · ")}
							</li>
						))}
					</ol>
				) : (
					<p>{missing[avail?.guion ?? "missing"]}</p>
				)}
			</Section>
			<Section title={data.media_basis === "draft_inputs" ? "Recursos asignados" : "Fondos, imágenes y videos"}>
				{data.media_basis === "draft_inputs" && <p>Estos recursos están asignados; podrían no aparecer en el resultado.</p>}
				{avail?.media === "available" && data.media?.length ? (
					<ul className="space-y-1">
						{data.media.map((item, index) => (
							<li key={`${item.id}-${index}`}>
								<span className="font-semibold">
									{item.name || "Recurso visual"}
								</span>
								<span className="text-nb-mute">
									{item.type === "video"
										? " · Video"
										: item.type === "image"
											? " · Imagen"
											: ""}
									{item.author ? ` · ${item.author}` : ""}
									{item.source ? ` · ${item.source}` : ""}
									{item.license ? ` · ${item.license}` : ""}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p>{missing[avail?.media ?? "missing"]}</p>
				)}
			</Section>
			<Section title="Miniaturas">
                {draft?.draftId === session.draft_id && draft.thumbnails && avail?.draft === "available" ? <div className="grid grid-cols-2 gap-3">
                  {(["A", "B"] as const).map((option) => {
                    const url = draft.thumbnails!.urls?.[option] || resolveApiUrl(`/api/v1/drafts/${encodeURIComponent(draft.draftId)}/thumbnails/${option}`);
                    return <Thumbnail key={`${draft.draftId}-${option}-${url}-${draft.thumbnails!.fingerprint}`} option={option} url={url} selected={draft.thumbnails!.selected === option} text={draft.thumbnails!.options?.[option]?.text} />;
                  })}
                </div> : <p>Miniaturas no disponibles.</p>}
            </Section>
            <Section title="Sonido">
				{avail?.music === "available" && data.music ? (
					<p>
						<span className="font-semibold">
							{data.music.name || "Música seleccionada"}
						</span>
						{data.music.author ? ` · ${data.music.author}` : ""}
						{data.music.source ? ` · ${data.music.source}` : ""}
						{data.music.license ? ` · ${data.music.license}` : ""}
					</p>
				) : (
					<p>{missing[avail?.music ?? "missing"]}</p>
				)}
			</Section>
		</div>
	);
}
