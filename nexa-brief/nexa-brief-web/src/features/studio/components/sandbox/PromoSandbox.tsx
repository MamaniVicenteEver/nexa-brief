"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	approvePromo,
	createPromoSession,
	getPromoSession,
	getPromoContent,
	importPromoDraft,
	listPromoAgents,
	promoSessionKey,
	promoSessionsKey,
	retryPromo,
	sendPromoMessage,
	type PromoProvider,
	type PromoSession,
} from "../../api/promo-service";
import { draftsKey } from "../../hooks/useDraft";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { isRecordable, ORIGINAL } from "../../hooks/useRecordPrototype";
import { PromoUsage } from "./PromoUsage";
import { PromoReview } from "./PromoReview";
import { PromoLegacyResources } from "./PromoLegacyResources";
import { PromoPreviewButton } from "./PromoPreviewButton";
import { DeletePromoSessionButton } from "./DeletePromoSessionButton";
import { DeletePrototypeButton } from "./DeletePrototypeButton";
import { promoPrototypeGroups } from "../../lib/promo-prototypes";

function safeReason(reason: string | null | undefined): string {
	if (!reason) return "";
	if (
		/https?:|file:|(?:^|[^\w])\/(?:[^\s/]+\/)*[^\s/]+|(?:^|\s)~\/|\\|\b(token|secret|password|api.?key|bearer|credencial)\b/i.test(
			reason,
		)
	)
		return "No se pudo verificar la disponibilidad del proveedor.";
	return reason.slice(0, 240);
}
function sessionName(session: PromoSession): string {
 const message = session.messages?.find((item) => item.role === "user")?.content ?? "";
 const clean = message.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
 return clean ? (clean.length > 80 ? `${clean.slice(0, 77).trimEnd()}…` : clean) : "Preparación sin título";
}

const status: Record<PromoSession["state"], string> = {
	queued: "En cola",
	running: "Preparando",
	review: "En revisión",
	ready: "Listo para grabar",
	failed: "No se pudo preparar",
};

export function PromoSandbox({ studio }: { studio: TemplateStudioController }) {
	const client = useQueryClient();
	const [selected, setSelected] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [message, setMessage] = useState("");
	const [requestChanges, setRequestChanges] = useState(false);
	const [expandedLegacyId, setExpandedLegacyId] = useState<string | null>(null);
	const [provider, setProvider] = useState<PromoProvider | null>(null);
	const messageInput = useRef<HTMLTextAreaElement>(null);
	const agents = useQuery({
		queryKey: ["promo-agents"],
		queryFn: ({ signal }) => listPromoAgents(signal),
		enabled: creating,
	});
	const session = useQuery({
		queryKey: promoSessionKey(selected ?? ""),
		queryFn: ({ signal }) => getPromoSession(selected!, signal),
		enabled: Boolean(selected),
		refetchInterval: (q) =>
			q.state.data && ["queued", "running"].includes(q.state.data.state)
				? 3000
				: false,
	});
	const current = session.data;
	const content = useQuery({
		queryKey: ["promo-content", current?.session_id, current?.revision, current?.draft_id],
		queryFn: ({ signal }) => getPromoContent(current!.session_id, signal),
		enabled: !!current && current.session_id === selected,
	});
	const previewBinding = useRef<string | null>(null);
	useEffect(() => {
		if (!selected) {
			if (previewBinding.current !== null) studio.clearPrototypePreview();
			previewBinding.current = null;
			return;
		}
		const owned = current?.session_id === selected ? current : null;
		const draft = owned?.draft_id ? studio.prototypes.find((item) => item.draftId === owned.draft_id) : undefined;
		const key = draft?.previewUrl ? JSON.stringify([selected, draft.draftId, draft.previewUrl]) : JSON.stringify([selected, null]);
		if (previewBinding.current === key) return;
		previewBinding.current = key;
		if (draft?.previewUrl) studio.previewPrototype(draft.draftId);
		else studio.clearPrototypePreview();
	}, [selected, current?.session_id, current?.draft_id, studio.prototypes, studio.previewPrototype, studio.clearPrototypePreview]);
	const refresh = () => {
		void client.invalidateQueries({
			queryKey: promoSessionsKey(studio.template.id),
		});
		void client.invalidateQueries({ queryKey: draftsKey(studio.template.id) });
		if (selected)
			void client.invalidateQueries({ queryKey: ["promo-content", selected] });
	};
	const accept = (data: PromoSession) => {
		client.setQueryData(promoSessionKey(data.session_id), data);
		setSelected(data.session_id);
		setCreating(false);
		setMessage("");
		setRequestChanges(false);
		refresh();
	};
	const create = useMutation({
		mutationFn: () =>
			createPromoSession(studio.template.id, message.trim(), provider!),
		onSuccess: accept,
	});
	const importDraft = useMutation({
		mutationFn: (id: string) => importPromoDraft(id),
		onSuccess: accept,
	});
	const send = useMutation({
		mutationFn: () => sendPromoMessage(selected!, message.trim()),
		onSuccess: accept,
	});
	const retry = useMutation({
		mutationFn: () => retryPromo(selected!),
		onSuccess: accept,
	});
	const approve = useMutation({
		mutationFn: () => approvePromo(selected!, current!.revision),
		onSuccess: accept,
		onError: () => {
			void client.invalidateQueries({ queryKey: promoSessionKey(selected!) });
			refresh();
		},
	});
	useEffect(() => {
		if (current) refresh();
	}, [current?.state, current?.revision, current?.draft_id]); // refresh draft after each completed revision
	useEffect(() => {
		const data = agents.data;
		if (!data) return;
		const options = data.agents ?? [];
		setProvider((previous) => {
			if (options.some((item) => item.provider === previous && item.available)) return previous;
			return options.find((item) => item.provider === data.default_provider && item.available)?.provider
				?? options.find((item) => item.available)?.provider
				?? null;
		});
	}, [agents.data]);
	useEffect(() => {
		if (requestChanges) messageInput.current?.focus();
	}, [requestChanges]);
	const busy =
		create.isPending ||
		importDraft.isPending ||
		send.isPending ||
		retry.isPending ||
		approve.isPending;
	const agent = agents.data?.agents?.find((item) => item.provider === provider);
	const error =
		create.error ||
		importDraft.error ||
		send.error ||
		retry.error ||
		approve.error ||
		session.error ||
		agents.error;
	const close = () => {
		refresh();
		if (selected)
			void client.cancelQueries({ queryKey: promoSessionKey(selected) });
		setSelected(null);
		setCreating(false);
		setMessage("");
		setRequestChanges(false);
		create.reset();
		importDraft.reset();
		send.reset();
		retry.reset();
		approve.reset();
	};
	if (!selected && !creating) {
		const { sessions, legacy } = promoPrototypeGroups(
			studio.promoSessions.data?.sessions ?? [],
			studio.promoSessions.data ? studio.prototypes : [],
			studio.promoSessions.data?.archived_draft_ids,
		);
		const demo = studio.original?.draft;
		const demoReady = !!demo && isRecordable(demo);

		return (
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-3">
				<div className="flex items-center justify-between">
					<h3 className="font-bold">Prototipos</h3>
					<button
						type="button"
						className="text-xs font-semibold"
						onClick={() => setCreating(true)}
					>
						+ Nuevo prototipo
					</button>
				</div>
				{studio.promoSessions.isLoading && (
					<p className="py-3 text-xs">Cargando prototipos…</p>
				)}
				{studio.promoSessions.error && (
					<p role="alert" className="py-3 text-xs">
						No se pudieron cargar los prototipos.{" "}
						<button
							type="button"
							onClick={() => studio.promoSessions.refetch()}
						>
							Reintentar
						</button>
					</p>
				)}
				{legacy.length > 0 && (
					<section className="mt-4">
						<h4 className="border-b border-nb-line pb-1 text-[11px] font-bold uppercase text-nb-mute">
							Prototipos existentes · pendientes de revisión
						</h4>
						<ul>
							{legacy.map((draft) => {
								const expanded = expandedLegacyId === draft.draftId;
								return <li key={draft.draftId} className="border-b border-nb-line py-2">
									<div className="flex min-w-0 items-center gap-2">
										<button
											type="button"
											className="min-w-0 flex-1 text-left text-xs"
											aria-expanded={expanded}
											aria-label={`${expanded ? "Ocultar" : "Ver"} recursos de ${draft.name || "Prototipo"}`}
											onClick={() => setExpandedLegacyId(expanded ? null : draft.draftId)}
										>
											<strong className="block truncate">{draft.name || "Prototipo"}</strong>
											<span className="text-[10px] text-nb-mute">{expanded ? "Ocultar recursos ▴" : "Ver canción, imágenes, videos y letra ▾"}</span>
										</button>
										<PromoPreviewButton studio={studio} draftId={draft.draftId} />
										<button
											type="button"
											disabled={busy}
											className="text-xs font-semibold disabled:opacity-50"
											onClick={() => importDraft.mutate(draft.draftId)}
										>
											Revisar
										</button>
										<DeletePrototypeButton draft={draft} />
									</div>
									{expanded && <PromoLegacyResources draftId={draft.draftId} onOpenReview={() => importDraft.mutate(draft.draftId)} />}
								</li>;
							})}
						</ul>
					</section>
				)}
				{importDraft.error && (
					<p role="alert" className="text-xs text-nb-accent-coral">
						{importDraft.error.message}
					</p>
				)}
				{([false, true] as const).map((ready) => (
					<section key={String(ready)} className="mt-4">
						<h4 className="border-b border-nb-line pb-1 text-[11px] font-bold uppercase text-nb-mute">
							{ready ? "Listos para grabar" : "Preparación y revisión"}
						</h4>
						<ul>
							{demo && demoReady === ready && (
								<li className="flex items-center gap-2 border-b border-nb-line py-2">
									<PromoPreviewButton studio={studio} draftId={demo.draftId} />
									<span className="min-w-0 flex-1 text-xs">
										<strong className="block">Demo</strong>
										<span>{demo.status === "prepared" ? "Preparado" : demo.status === "failed" ? "Grabación fallida" : demo.status === "rendering" ? "Grabando" : demo.status === "rendered" ? "Grabado" : "Preparación pendiente"}</span>
									</span>
									{ready && <button type="button" className="text-xs font-semibold" onClick={() => studio.recordPrototype(ORIGINAL)}>Grabar</button>}
								</li>
							)}
							{sessions
								.filter((s) => (s.state === "ready") === ready)
								.map((s) => (
									<li
										key={s.session_id}
										className="flex items-center gap-2 border-b border-nb-line py-2"
									>
										<button
											type="button"
											className="min-w-0 flex-1 text-left text-xs"
											onClick={() => setSelected(s.session_id)}
										>
											<strong className="block">
												{studio.prototypes.find((d) => d.draftId === s.draft_id)
													?.name || sessionName(s)}
											</strong>
											<span>{status[s.state]}</span>
										</button>
										<PromoPreviewButton studio={studio} draftId={s.draft_id} />
										{ready && s.draft_id && (
											<button
												type="button"
												className="text-xs font-semibold"
												onClick={() => studio.recordPrototype(s.draft_id!)}
											>
												Grabar
											</button>
										)}
										<DeletePromoSessionButton session={s} name={studio.prototypes.find((d) => d.draftId === s.draft_id)?.name || sessionName(s)} />
									</li>
								))}
						</ul>
					</section>
				))}
			</div>
		);
	}
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
				<button type="button" onClick={close} className="text-xs">
					← Prototipos
				</button>
				<h3 className="mt-3 font-bold">
					{creating ? "Nuevo prototipo" : "Revisión del prototipo"}
				</h3>
				{creating && (
					<section className="mt-3 space-y-3" aria-label="Configuración del prototipo">
						<p className="text-xs leading-relaxed text-nb-mute">
							Elige un agente y cuéntale qué quieres crear. Podrás revisar la propuesta antes de grabar.
						</p>
						<fieldset>
							<legend className="mb-2 text-xs font-semibold">Agente</legend>
							{agents.isLoading && <p className="text-xs text-nb-mute" role="status">Comprobando agentes…</p>}
							{agents.isError && (
								<button type="button" onClick={() => agents.refetch()} className="text-xs font-semibold underline underline-offset-2">Reintentar comprobación</button>
							)}
							<div className="space-y-2">
								{agents.data?.agents?.map((item) => (
									<label key={item.provider} className={`flex min-w-0 gap-3 rounded-xl border p-3 text-xs transition-colors ${provider === item.provider ? "border-nb-ink bg-nb-bg-2" : "border-nb-line"} ${item.available ? "cursor-pointer" : "opacity-75"}`}>
										<input type="radio" name="promo-provider" value={item.provider} checked={provider === item.provider} disabled={!item.available} onChange={() => setProvider(item.provider)} className="mt-0.5 shrink-0 accent-nb-ink" />
										<span className="min-w-0 flex-1">
											<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
												<strong className="text-sm">{item.provider === "codex" ? "Codex" : "Claude"}</strong>
												<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.available ? "bg-emerald-100 text-emerald-800" : "bg-nb-bg-2 text-nb-mute"}`}>{item.available ? "Disponible" : "No disponible"}</span>
											</span>
											<span className="mt-1 block break-words text-nb-mute">{item.model || "Modelo no informado"}{item.reasoning_effort ? ` · ${item.reasoning_effort}` : ""}</span>
											{!item.available && (item.unavailable_reason || item.installed === false || item.authenticated === false) && <span className="mt-2 block leading-relaxed">{safeReason(item.unavailable_reason) || (item.installed === false ? "El agente no está instalado." : "La sesión del agente no está autenticada.")}</span>}
											{item.quota_status && item.quota_status.toLowerCase() !== "unknown" && <span className="mt-1 block text-nb-mute">Cuota: {item.quota_status}</span>}
										</span>
									</label>
								))}
							</div>
							{agents.data && <p className="mt-2 text-[11px] leading-relaxed text-nb-mute">La disponibilidad no confirma el saldo o la cuota del proveedor.</p>}
							{agents.data && !agents.data.agents?.some((item) => item.available) && <p className="mt-2 text-xs" role="status">No hay agentes disponibles. Comprueba su instalación y sesión, y vuelve a intentarlo.</p>}
						</fieldset>
					</section>
				)}
				{selected && session.isLoading && (
					<p className="mt-3 text-xs">Cargando prototipo…</p>
				)}
				{current && (
					<>
						<p aria-live="polite" className="mt-3 text-xs font-semibold">
							{status[current.state]}
							{current.stage ? ` · ${current.stage}` : ""}
						</p>
						{current.error && (
							<p
								role="alert"
								className="mt-2 whitespace-pre-wrap text-xs text-nb-accent-coral"
							>
								{current.error}
							</p>
						)}
						{current.quality?.errors?.map((item, i) => (
							<p key={i} className="mt-2 text-xs text-nb-accent-coral">
								{typeof item === "string"
									? item
									: "Una comprobación necesita revisión."}
							</p>
						))}
						{current.quality?.warnings?.map((item, i) => (
							<p key={i} className="mt-2 text-xs">
								{typeof item === "string"
									? item
									: "Hay una advertencia para revisar."}
							</p>
						))}
						{current.state === "review" && (
							<p className="mt-3 text-xs">
								Antes de confirmar, revisa los títulos, las descripciones y el guion,
								ambos formatos y las miniaturas. Las comprobaciones técnicas no
								sustituyen esta revisión humana.
							</p>
						)}
						{!content.isError && !content.isFetching && content.data?.session_id === current.session_id &&
						content.data?.revision === current.revision &&
						content.data?.draft_id === current.draft_id &&
						content.data?.can_retry_preparation === true &&
						current.state === "failed" && (
							<div className="mt-3 text-xs">
								<p>
									Reutiliza los datos y la investigación sin volver a pedir el
									guion.
								</p>
								<button
									type="button"
									disabled={busy}
									onClick={() => retry.mutate()}
									className="mt-1 rounded border px-2 py-1 font-semibold disabled:opacity-50"
								>
									Reintentar preparación
								</button>
							</div>
						)}
						<div className="mt-3 flex flex-wrap gap-2">
							{current.draft_id && (
								<button
									type="button"
									className="rounded border px-2 py-1 text-xs"
									onClick={() => studio.previewPrototype(current.draft_id!)}
								>
									Ver vista previa
								</button>
							)}
							{["review", "ready", "failed"].includes(current.state) && (
								<button
									type="button"
									className="rounded border px-2 py-1 text-xs"
									aria-expanded={requestChanges}
									aria-controls="promo-corrections"
									onClick={() => setRequestChanges((open) => !open)}
								>
									Sugerir cambios
								</button>
							)}
							{current.state === "review" && (
								<button
									type="button"
									disabled={
										busy || !current.draft_id || !current.quality?.passed
									}
									onClick={() => approve.mutate()}
									className="rounded bg-nb-ink px-2 py-1 text-xs font-bold text-nb-surface disabled:opacity-50"
								>
									Confirmo: listo para grabar
								</button>
							)}
							{current.state === "ready" && current.draft_id && (
								<button
									type="button"
									disabled={busy}
									onClick={() => studio.recordPrototype(current.draft_id!)}
									className="rounded bg-nb-ink px-2 py-1 text-xs font-bold text-nb-surface disabled:opacity-50"
								>
									Ir a grabar
								</button>
							)}
						</div>
					</>
				)}
				{(creating ||
					(current &&
						requestChanges &&
						["review", "ready", "failed"].includes(current.state))) && (
					<section id="promo-corrections" className="mt-4 min-w-0" aria-label={creating ? "Idea para el prototipo" : "Conversación de cambios"}>
						{current && (
							<div className="rounded-xl border border-nb-line bg-nb-bg-2 p-3">
								<h4 className="text-xs font-bold">Conversación</h4>
								<p className="mt-1 text-[11px] text-nb-mute">Indica qué quieres ajustar en la siguiente versión.</p>
								<div aria-label="Historial de conversación" className="mt-3 max-h-64 space-y-2 overflow-y-auto" role="log">
									{(current.messages ?? []).length === 0 && <p className="text-xs text-nb-mute">Todavía no hay mensajes.</p>}
									{(current.messages ?? []).map((item) => (
										<div key={item.id} className={`rounded-lg border border-nb-line p-2.5 text-xs ${item.role === "user" ? "ml-4 bg-nb-surface" : "mr-4 bg-nb-surface/70"}`}>
											<strong>{item.role === "user" ? "Tú" : "Agente"}</strong>
											<p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{item.content}</p>
										</div>
									))}
								</div>
							</div>
						)}
						<form
							className={current ? "mt-3" : ""}
							onSubmit={(event) => {
								event.preventDefault();
								if (!message.trim() || busy) return;
								if (creating && agent?.available) create.mutate();
								else if (!creating) send.mutate();
							}}
						>
							<label htmlFor="promo-message" className="block text-xs font-semibold">
								{creating ? "Idea e instrucciones" : "Correcciones"}
							</label>
							<textarea
								ref={messageInput}
								id="promo-message"
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								rows={5}
								className="mt-2 w-full resize-y rounded-xl border border-nb-line bg-nb-surface p-3 text-xs leading-relaxed outline-none focus:border-nb-ink focus:ring-1 focus:ring-nb-ink"
								placeholder={creating ? "Ej.: Una promo sobre auroras, de 60 segundos, con tono emocionante…" : "Ej.: Cambia el cierre y usa imágenes más luminosas…"}
							/>
							<p className="mt-1 text-[11px] text-nb-mute">{creating ? "Incluye el tema, la duración y el estilo que imaginas." : "Enviar cambios inicia una nueva preparación para tu revisión."}</p>
							<button
								type="submit"
								disabled={!message.trim() || busy || (creating && !agent?.available)}
								className="mt-3 w-full rounded-lg bg-nb-ink px-3 py-2.5 text-xs font-bold text-nb-surface transition-opacity disabled:opacity-50"
							>
								{busy ? "Enviando…" : creating ? "Crear prototipo" : "Enviar correcciones"}
							</button>
						</form>
					</section>
				)}
				{error && (
					<p role="alert" className="mt-2 text-xs text-nb-accent-coral">
						{error.message}
					</p>
				)}
				{current && <div className="mt-3"><PromoReview session={current} draft={studio.prototypes.find((item) => item.draftId === current.draft_id)} /></div>}
				{current && (
					<div className="mt-4 border-t border-nb-line pt-2">
						<PromoUsage usage={current.usage} />
					</div>
				)}
			</div>
		</div>
	);
}
