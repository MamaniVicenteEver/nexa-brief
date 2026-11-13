"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	ArrowUpRight,
	Check,
	LoaderCircle,
	RefreshCw,
	Send,
	SlidersHorizontal,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PlatformIcon } from "@/features/channels";
import {
	buildConnectChannelUrl,
	getChannels,
} from "@/features/channels/api/channels-service";
import { cn } from "@/lib/utils";
import { brandKey } from "@/shared/components/publish/brand-groups";
import {
	getImageCapabilities,
	getImagePost,
	getImagePostDetail,
	getPublicationDetail,
	prepareImagePostVariant,
	publishImageNow,
	reconcileImagePostDelivery,
	reviewImagePost,
	scheduleImagePost,
	setImagePostFormat,
} from "../image-posts-service";
import type {
	ImagePost,
	ImagePostFormat,
	MetricName,
	MetricsWindow,
	PublicationDeliveryDetail,
	PublicationDetail,
} from "../types";

import { IMAGE_FORMATS } from "../image-formats";

const networks = ["instagram", "facebook", "tiktok"] as const;
const networkNames = {
	instagram: "Instagram",
	facebook: "Facebook",
	tiktok: "TikTok",
};
const blockedStatuses = new Set([
	"queued",
	"publishing",
	"published",
	"outcome_unknown",
]);
const keyOf = (platform: string, alias: string) => `${platform}:${alias}`;

export function ImagePostPublishingPanel({
	publication,
	postId,
	format = publication.format ?? "4:5",
	onFormatChange,
	onPrepared,
	defaultSelectAll = false,
}: {
	publication: PublicationDetail;
	postId?: string | null;
	format?: ImagePostFormat;
	onFormatChange?: (format: ImagePostFormat) => void;
	onPrepared?: (post: ImagePost) => void;
	defaultSelectAll?: boolean;
}) {
	const t = useTranslations("imagePosts.publishing");
	const art = useTranslations("imagePosts.artwork");
	const locale = useLocale();
	const queryClient = useQueryClient();
	const id = postId || publication.postId || null;
	const [selected, setSelected] = useState<string[]>([]);
	const [accountFormats, setAccountFormats] = useState<
		Record<string, ImagePostFormat>
	>({});
	const [expandedFormats, setExpandedFormats] = useState<
		Record<string, boolean>
	>({});
	const [busy, setBusy] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const sending = useRef(false);
	const [preparing, setPreparing] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [window, setWindow] = useState<MetricsWindow>("48h");
	const live = useQuery({
		queryKey: ["image-posts", "publishing", id ?? publication.publicationId],
		queryFn: ({ signal }) =>
			id
				? getImagePostDetail(id, signal)
				: getPublicationDetail(publication.publicationId, signal),
		initialData: publication,
		initialDataUpdatedAt: 0,
		refetchOnWindowFocus: false,
		retry: 1,
		refetchInterval: (query) =>
			busy ||
			query.state.data?.deliveries.some(
				(d) =>
					d.status === "publishing" ||
					(d.status === "queued" && !d.scheduledAt),
			)
				? 3000
				: false,
	});
	const detail = live.data ?? publication;
	const capabilities = useQuery({
		queryKey: ["image-posts", "capabilities", detail.categoryId, id],
		queryFn: ({ signal }) =>
			getImageCapabilities(detail.categoryId, signal, id),
		staleTime: 60_000,
		retry: 1,
	});
	const channels = useQuery({
		queryKey: ["channels"],
		queryFn: ({ signal }) => getChannels(signal),
		staleTime: 60_000,
		retry: 1,
	});
	const accounts = capabilities.data?.accounts ?? [];
	const published = detail.deliveries.filter((d) => d.status === "published");
	const pending = detail.deliveries.filter((d) =>
		["queued", "publishing", "outcome_unknown"].includes(d.status),
	);
	const failed = detail.deliveries.filter((d) =>
		["failed_retryable", "failed_permanent"].includes(d.status),
	);
	const hasDelivery = (platform: string, alias: string) =>
		detail.deliveries.some(
			(d) =>
				d.platform === platform &&
				d.accountAlias === alias &&
				blockedStatuses.has(d.status),
		);
	const canCreate = Boolean(
		id &&
			detail.slides.length &&
			["ready_for_review", "rendered", "approved"].includes(detail.status) &&
			!detail.isDemo &&
			!capabilities.data?.isDemo &&
			!capabilities.isError &&
			!live.isError,
	);
	const accountFormat = (platform: string, alias: string) =>
		accountFormats[keyOf(platform, alias)] ?? format;
	const formatAllowed = (
		platform: string,
		selectedFormat: ImagePostFormat = format,
	) => platform !== "instagram" || selectedFormat === "4:5";
	const selectable = accounts.filter(
		(a) =>
			a.canPublish &&
			formatAllowed(a.platform, accountFormat(a.platform, a.alias)) &&
			!hasDelivery(a.platform, a.alias),
	);
	const chosen = selectable.filter((a) =>
		selected.includes(keyOf(a.platform, a.alias)),
	);
	const allSelected =
		selectable.length > 0 && chosen.length === selectable.length;
	const partlySelected = chosen.length > 0 && !allSelected;
	const initializedSelection = useRef(false);
	useEffect(() => {
		if (
			!defaultSelectAll ||
			initializedSelection.current ||
			!canCreate ||
			capabilities.isLoading ||
			capabilities.isError ||
			!accounts.length
		)
			return;
		initializedSelection.current = true;
		setSelected(selectable.map((a) => keyOf(a.platform, a.alias)));
	}, [
		defaultSelectAll,
		canCreate,
		capabilities.isLoading,
		capabilities.isError,
		accounts.length,
		selectable,
	]);
	const progressTotal = published.length + pending.length + failed.length;
	const progressFinished = published.length + failed.length;
	const progressPercent = progressTotal
		? Math.round((progressFinished / progressTotal) * 100)
		: 0;
	const showProgress = busy || progressTotal > 0;
	const progressActive =
		busy || pending.some((d) => d.status !== "outcome_unknown");
	const progressDeterminate = progressTotal > 0 && !preparing;
	const progressLabel = preparing
		? t("preparing")
		: progressActive
			? t("progressSending")
			: pending.length
				? t("progressReview")
				: failed.length
					? t("progressFailed")
					: t("progressComplete");
	const showDestinations =
		!busy &&
		!pending.length &&
		(!published.length || (canCreate && selectable.length > 0));
	const tiktokAccounts = (channels.data ?? []).filter(
		(a) =>
			a.platform === "tiktok" &&
			[detail.categoryId, detail.categoryName].some(
				(name) => brandKey(name) === brandKey(a.name),
			),
	);
	const dateTime = (value: string | null, timezone?: string | null) => {
		if (!value || Number.isNaN(Date.parse(value))) return t("noDate");
		try {
			return new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: timezone || undefined,
			}).format(new Date(value));
		} catch {
			return new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value));
		}
	};

	async function refresh() {
		await Promise.all([
			live.refetch(),
			capabilities.refetch(),
			queryClient.invalidateQueries({ queryKey: ["image-posts"] }),
		]);
	}

	async function send() {
		if (sending.current || !id || !chosen.length || !canCreate) return;
		sending.current = true;
		setBusy(true);
		setPreparing(true);
		setError("");
		setNotice("");
		try {
			// La revisión y los destinos se comprueban de nuevo contra el registro vigente.
			let fresh = await getImagePost(id);
			if (fresh.isDemo) throw new Error(t("demoUnavailable"));
			if (fresh.revision !== detail.revision)
				throw new Error(t("changedBeforePublish"));
			if (
				chosen.some(
					(account) =>
						!formatAllowed(
							account.platform,
							accountFormat(account.platform, account.alias),
						),
				)
			)
				throw new Error(art("instagramRestriction"));
			const available = chosen.filter(
				(a) =>
					!fresh.deliveries.some(
						(d) =>
							d.platform === a.platform &&
							d.accountAlias === a.alias &&
							blockedStatuses.has(d.status),
					),
			);
			if (!available.length) throw new Error(t("alreadySent"));
			if (!["ready_for_review", "rendered", "approved"].includes(fresh.status))
				throw new Error(t("notReady"));
			const verified = await getImageCapabilities(
				detail.categoryId,
				undefined,
				id,
			);
			const unavailable = available.find(
				(account) =>
					!verified.accounts.some(
						(row) =>
							row.platform === account.platform &&
							row.alias === account.alias &&
							row.canPublish,
					),
			);
			if (unavailable)
				throw new Error(t("accountChanged", { name: unavailable.name }));
			// Preparar todas las composiciones antes de aprobar o crear ningún envío.
			let exported = await setImagePostFormat(id, fresh.revision, format);
			const formats = new Set(
				available.map((a) => accountFormat(a.platform, a.alias)),
			);
			for (const targetFormat of formats) {
				if (targetFormat !== format)
					exported = await prepareImagePostVariant(
						id,
						exported.revision,
						targetFormat,
					);
			}
			onPrepared?.(exported);
			fresh = await getImagePost(id);
			if (fresh.revision !== exported.revision || fresh.format !== format)
				throw new Error(t("changedBeforePublish"));
			if (
				available.some((a) =>
					fresh.deliveries.some(
						(d) =>
							d.platform === a.platform &&
							d.accountAlias === a.alias &&
							blockedStatuses.has(d.status),
					),
				)
			)
				throw new Error(t("alreadySent"));
			setPreparing(false);
			setPublishing(true);
			if (fresh.status !== "approved")
				fresh = await reviewImagePost(id, fresh.revision, "approve");
			const deliveries = await scheduleImagePost(
				id,
				fresh.revision,
				available.map((a) => ({
					platform: a.platform,
					account_alias: a.alias,
					format: accountFormat(a.platform, a.alias),
					placement: fresh.kind === "carousel" ? "carousel" : "image",
				})),
			);
			const failures: string[] = [];
			let completed = 0;
			let started = 0;
			for (const delivery of deliveries) {
				let result: Awaited<ReturnType<typeof publishImageNow>> | undefined;
				try {
					result = await publishImageNow(delivery.deliveryId);
				} catch (cause) {
					// La cola puede haber tomado el envío antes de que llegue «publicar ahora».
					const latest = await getImagePost(id).catch(() => null);
					const existing = latest?.deliveries.find(
						(d) => d.deliveryId === delivery.deliveryId,
					);
					if (
						existing &&
						["published", "queued", "publishing"].includes(existing.status)
					)
						result = existing;
					else
						failures.push(
							`${networkNames[delivery.platform]} · ${delivery.accountAlias}: ${cause instanceof Error ? cause.message : t("requestFailed")}`,
						);
				}
				if (result?.status === "published") completed += 1;
				else if (result && ["queued", "publishing"].includes(result.status))
					started += 1;
				else if (result)
					failures.push(
						`${networkNames[result.platform]} · ${result.accountAlias}: ${t(`status.${result.status}`)}`,
					);
				await live.refetch();
			}
			if (completed || started)
				setNotice(
					[
						completed ? t("sent", { count: completed }) : "",
						started ? t("started", { count: started }) : "",
					]
						.filter(Boolean)
						.join(" "),
				);
			if (failures.length) setError(failures.join("\n"));
			setSelected([]);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("requestFailed"));
		} finally {
			try {
				await refresh();
			} finally {
				sending.current = false;
				setPreparing(false);
				setPublishing(false);
				setBusy(false);
			}
		}
	}

	async function recover(delivery: PublicationDeliveryDetail) {
		if (sending.current || !id) return;
		sending.current = true;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await reconcileImagePostDelivery(delivery.deliveryId);
			if (result.status === "published") setNotice(t("sent", { count: 1 }));
			else setNotice(t(`status.${result.status}`));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("requestFailed"));
		} finally {
			try {
				await refresh();
			} finally {
				sending.current = false;
				setBusy(false);
			}
		}
	}

	return (
		<div className="flex min-w-0 flex-col gap-5">
			<header className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h4 className="text-sm font-bold">{t("heading")}</h4>
					<p className="mt-1 text-xs text-nb-mute">
						{t("format", {
							count: detail.slides.length,
							kind: detail.kind === "carousel" ? t("carousel") : t("image"),
						})}
					</p>
				</div>
				<button
					type="button"
					aria-label={t("refresh")}
					title={t("refresh")}
					onClick={() => void refresh()}
					disabled={busy || live.isFetching}
					className="flex size-8 shrink-0 items-center justify-center rounded-full border border-nb-line disabled:opacity-40"
				>
					<RefreshCw
						className={cn("size-3.5", live.isFetching && "animate-spin")}
					/>
				</button>
			</header>
			<div className="grid grid-cols-3 gap-2">
				{[
					[published.length, "publishedCount"],
					[pending.length, "pendingCount"],
					[failed.length, "failedCount"],
				].map(([value, label]) => (
					<div
						key={label}
						className="rounded-xl border border-nb-line bg-nb-bg-2/40 p-2.5"
					>
						<p className="text-xl font-bold tabular-nums">{value}</p>
						<p className="mt-1 text-[10px] text-nb-mute">{t(String(label))}</p>
					</div>
				))}
			</div>
			{showProgress && (
				<section
					aria-label={t("progressHeading")}
					className="rounded-xl border border-nb-line bg-nb-bg-2/40 p-3"
				>
					<div
						className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold"
						aria-live="polite"
					>
						<p className="flex min-w-0 items-center gap-2">
							{progressActive && (
								<LoaderCircle
									aria-hidden
									className="size-3.5 shrink-0 animate-spin"
								/>
							)}
							{progressLabel}
						</p>
						{progressDeterminate && (
							<span className="shrink-0 tabular-nums">{progressPercent}%</span>
						)}
					</div>
					<div
						role="progressbar"
						aria-label={t("progressHeading")}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progressDeterminate ? progressPercent : undefined}
						aria-valuetext={
							progressDeterminate
								? t("progressCount", {
										count: progressFinished,
										total: progressTotal,
									})
								: progressLabel
						}
						className="relative h-2 overflow-hidden rounded-full bg-nb-line/60"
					>
						<div
							className={cn(
								"h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
								failed.length
									? "bg-red-500"
									: pending.some((d) => d.status === "outcome_unknown")
										? "bg-amber-500"
										: "bg-emerald-600",
								!progressDeterminate &&
									"w-1/3 animate-pulse motion-reduce:animate-none",
							)}
							style={
								progressDeterminate
									? { width: `${progressPercent}%` }
									: undefined
							}
						/>
					</div>
					{progressDeterminate && (
						<p className="mt-2 text-[11px] text-nb-mute">
							{t("progressCount", {
								count: progressFinished,
								total: progressTotal,
							})}
						</p>
					)}
				</section>
			)}
			{error && (
				<p
					role="alert"
					className="whitespace-pre-wrap rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300"
				>
					{error}
				</p>
			)}
			{notice && !showProgress && (
				<p
					role="status"
					className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300"
				>
					{notice}
				</p>
			)}
			{live.isError && (
				<p role="alert" className="text-xs text-red-700 dark:text-red-300">
					{t("loadFailed")}
				</p>
			)}
			{showDestinations && (
				<section className="flex flex-col gap-2.5">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h5 className="text-[10px] font-bold tracking-widest text-nb-mute uppercase">
							{t("destinations")}
						</h5>
						<label className="flex items-center gap-2 text-[11px] font-semibold text-nb-ink-soft has-disabled:cursor-not-allowed has-disabled:opacity-40">
							<input
								type="checkbox"
								checked={allSelected}
								ref={(node) => {
									if (node) node.indeterminate = partlySelected;
								}}
								disabled={
									busy ||
									!canCreate ||
									!selectable.length ||
									capabilities.isLoading ||
									live.isFetching
								}
								onChange={(event) =>
									setSelected(
										event.target.checked
											? selectable.map((a) => keyOf(a.platform, a.alias))
											: [],
									)
								}
								className="size-4 shrink-0 accent-black"
							/>
							{t("selectAll")}
						</label>
					</div>
					{capabilities.isLoading ? (
						<p className="flex items-center gap-2 text-xs text-nb-mute">
							<LoaderCircle className="size-3.5 animate-spin" />
							{t("loadingAccounts")}
						</p>
					) : capabilities.isError ? (
						<p role="alert" className="text-xs text-red-700 dark:text-red-300">
							{t("accountsFailed")}
						</p>
					) : (
						networks.map((platform) => (
							<section
								key={platform}
								className="rounded-xl border border-nb-line p-3"
							>
								<div className="mb-2 flex items-center gap-2">
									<PlatformIcon
										platform={platform}
										className="size-5 shrink-0"
									/>
									<h6 className="text-xs font-bold">
										{networkNames[platform]}
									</h6>
								</div>
								{platform === "instagram" &&
									!formatAllowed(platform) &&
									!published.length && (
										<div className="mb-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
											<p>{art("instagramRestriction")}</p>
											{onFormatChange && (
												<button
													type="button"
													disabled={busy}
													onClick={() => onFormatChange("4:5")}
													className="mt-2 rounded-full border border-current px-3 py-1 font-semibold disabled:opacity-40"
												>
													{art("useInstagramFormat")}
												</button>
											)}
										</div>
									)}
								{platform === "tiktok" ? (
									<div className="text-[11px] leading-relaxed text-nb-mute">
										{tiktokAccounts.map((a) => (
											<p
												key={a.alias}
												className="mb-1 font-semibold text-nb-ink-soft"
											>
												{a.handle || a.name}
											</p>
										))}
										<p>{t("tiktokUnavailable")}</p>
									</div>
								) : accounts.filter((a) => a.platform === platform).length ? (
									accounts
										.filter((a) => a.platform === platform)
										.map((a) => {
											const key = keyOf(a.platform, a.alias);
											const existing = detail.deliveries.find(
												(d) =>
													d.platform === a.platform &&
													d.accountAlias === a.alias &&
													blockedStatuses.has(d.status),
											);
											const disabled =
												busy ||
												!a.canPublish ||
												!canCreate ||
												Boolean(existing) ||
												!formatAllowed(
													a.platform,
													accountFormat(a.platform, a.alias),
												);
											return (
												<div key={key}>
													<div className="flex items-start gap-2">
														<label
															className={cn(
																"flex items-start gap-2.5 rounded-lg py-1.5",
																disabled
																	? "text-nb-mute"
																	: "cursor-pointer text-nb-ink",
															)}
														>
															<input
																type="checkbox"
																aria-label={`${networkNames[a.platform]} · ${a.name}`}
																checked={chosen.some(
																	(account) =>
																		keyOf(account.platform, account.alias) ===
																		key,
																)}
																disabled={disabled}
																onChange={(event) =>
																	setSelected((old) =>
																		event.target.checked
																			? [...old, key]
																			: old.filter((value) => value !== key),
																	)
																}
																className="mt-0.5 size-4 shrink-0 accent-black"
															/>
															<span className="min-w-0 flex-1">
																<span className="block text-xs font-semibold">
																	{a.name}
																</span>
																<span className="block text-[10px]">
																	{a.alias}
																	{existing
																		? ` · ${t(`status.${existing.status}`)}`
																		: !a.canPublish
																			? ` · ${t("accountUnavailable")}`
																			: ""}
																</span>
															</span>
															{existing?.status === "published" && (
																<Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
															)}
														</label>
														<button
															type="button"
															disabled={busy || Boolean(existing)}
															aria-label={art("accountSettings", {
																network: networkNames[a.platform],
																name: a.name,
															})}
															title={art("accountSettings", {
																network: networkNames[a.platform],
																name: a.name,
															})}
															aria-expanded={Boolean(expandedFormats[key])}
															onClick={() =>
																setExpandedFormats((old) => ({
																	...old,
																	[key]: !old[key],
																}))
															}
															className="ml-auto mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-nb-line disabled:opacity-40"
														>
															<SlidersHorizontal className="size-3.5" />
														</button>
													</div>
													{a.publishBlockReason ===
														"ATTRIBUTION_COMMENT_REQUIRED" && (
														<p className="my-2 rounded-lg bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-800">
															{t("commentPermissionRequired")}{" "}
															<a
																className="font-semibold underline"
																href={buildConnectChannelUrl(
																	a.platform,
																	a.alias,
																)}
															>
																{t("reconnectPermissions")}
															</a>
														</p>
													)}
													{expandedFormats[key] && (
														<div className="my-2 rounded-lg bg-nb-bg-2/60 p-2.5 text-[11px]">
															<label className="flex flex-col gap-1.5">
																{art("accountFormat")}
																<select
																	aria-label={art("accountSettings", {
																		network: networkNames[a.platform],
																		name: a.name,
																	})}
																	value={accountFormats[key] ?? "modal"}
																	disabled={busy || Boolean(existing)}
																	onChange={(event) =>
																		setAccountFormats((old) => {
																			const next = { ...old };
																			if (event.target.value === "modal")
																				delete next[key];
																			else
																				next[key] = event.target
																					.value as ImagePostFormat;
																			return next;
																		})
																	}
																	className="rounded-lg border border-nb-line bg-nb-bg px-2 py-1.5"
																>
																	<option value="modal">
																		{art("inheritFormat", { format })}
																	</option>
																	{IMAGE_FORMATS.map((profile) => (
																		<option
																			key={profile.id}
																			value={profile.id}
																			disabled={
																				!formatAllowed(a.platform, profile.id)
																			}
																		>
																			{profile.id} · {profile.width} ×{" "}
																			{profile.height}
																		</option>
																	))}
																</select>
															</label>
															{a.platform === "instagram" && (
																<p className="mt-2 text-nb-mute">
																	{art("instagramRestriction")}
																</p>
															)}
														</div>
													)}
												</div>
											);
										})
								) : (
									<p className="text-[11px] text-nb-mute">{t("noAccount")}</p>
								)}
							</section>
						))
					)}
					{canCreate && (
						<>
							<details className="rounded-xl bg-nb-bg-2/50 p-3 text-[11px]">
								<summary className="cursor-pointer font-semibold">
									{t("reviewCopy")}
								</summary>
								<p className="mt-2 whitespace-pre-wrap leading-relaxed text-nb-ink-soft">
									{chosen.some((a) => a.platform === "facebook") &&
									!chosen.some((a) => a.platform === "instagram")
										? detail.copy.facebook.caption
										: detail.copy.instagram.caption}
								</p>
							</details>
							<button
								type="button"
								disabled={
									busy ||
									!chosen.length ||
									capabilities.isLoading ||
									live.isFetching
								}
								onClick={() => void send()}
								className="flex w-full items-center justify-center gap-2 rounded-full bg-nb-ink px-4 py-3 text-xs font-bold text-nb-bg disabled:cursor-not-allowed disabled:opacity-35"
							>
								{busy ? (
									<LoaderCircle className="size-4 animate-spin" />
								) : (
									<Send className="size-3.5" />
								)}
								{preparing
									? t("preparing")
									: publishing
										? t("sending")
										: detail.status === "approved"
											? t("publish", { count: chosen.length })
											: t("approvePublish", { count: chosen.length })}
							</button>
							<p className="text-[10px] leading-relaxed text-nb-mute">
								{t("selectionHint")}
							</p>
						</>
					)}
					{!canCreate && !published.length && !pending.length && (
						<p className="text-[11px] leading-relaxed text-nb-mute">
							{t("notReady")}
						</p>
					)}
				</section>
			)}
			<section className="flex flex-col gap-3 border-t border-nb-line pt-4">
				<div className="flex items-center justify-between gap-2">
					<h5 className="text-[10px] font-bold tracking-widest text-nb-mute uppercase">
						{t("history")}
					</h5>
					<select
						aria-label={t("metricsWindow")}
						value={window}
						onChange={(event) => setWindow(event.target.value as MetricsWindow)}
						className="min-w-0 rounded-md border border-nb-line bg-nb-bg px-2 py-1 text-[10px]"
					>
						<option value="48h">48 h</option>
						<option value="7d">7 d</option>
					</select>
				</div>
				{!detail.deliveries.length && (
					<p className="text-xs leading-relaxed text-nb-mute">
						{t("noHistory")}
					</p>
				)}
				{detail.deliveries.map((delivery) => {
					const snapshots = detail.metricsSnapshots
						.filter(
							(s) =>
								s.deliveryId === delivery.deliveryId && s.window === window,
						)
						.sort(
							(a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
						);
					const snapshot = snapshots[0];
					const metrics = snapshot?.status === "ok" ? snapshot.metrics : null;
					const mainMetric: MetricName =
						delivery.placement === "reel" ? "plays" : "impressions";
					const metricRows: MetricName[] = [
						mainMetric,
						"likes",
						"comments",
						"reach",
					];
					const account = accounts.find(
						(a) =>
							a.platform === delivery.platform &&
							a.alias === delivery.accountAlias,
					);
					const isPublished = delivery.status === "published";
					return (
						<article
							key={delivery.deliveryId}
							className="rounded-xl border border-nb-line p-3"
						>
							<div className="flex items-start gap-2">
								<PlatformIcon
									platform={delivery.platform}
									className="mt-0.5 size-5 shrink-0"
								/>
								<div className="min-w-0 flex-1">
									<h6 className="text-xs font-bold">
										{networkNames[delivery.platform]} ·{" "}
										{account?.name || delivery.accountAlias}
									</h6>
									<p className="mt-0.5 text-[10px] text-nb-mute">
										{delivery.accountAlias}
									</p>
								</div>
							</div>
							<p
								className={cn(
									"mt-2 text-[11px] font-semibold",
									isPublished
										? "text-emerald-700 dark:text-emerald-300"
										: delivery.lastError
											? "text-red-700 dark:text-red-300"
											: "text-nb-ink-soft",
								)}
							>
								{t(`status.${delivery.status}`)}
							</p>
							<p className="mt-1 text-[10px] leading-relaxed text-nb-mute">
								{delivery.publishedAt
									? t("publishedAt", {
											date: dateTime(delivery.publishedAt, delivery.timezone),
										})
									: delivery.scheduledAt
										? t("scheduledAt", {
												date: dateTime(delivery.scheduledAt, delivery.timezone),
											})
										: t("noDate")}
								{delivery.timezone ? ` · ${delivery.timezone}` : ""}
							</p>
							{isPublished && (
								<>
									<dl className="mt-3 grid grid-cols-2 gap-2">
										{metricRows.map((metric) => (
											<div
												key={metric}
												className="rounded-lg bg-nb-bg-2/55 p-2"
											>
												<dt className="text-[10px] text-nb-mute">
													{t(`metrics.${metric}`)}
												</dt>
												<dd className="mt-1 text-base font-bold tabular-nums">
													{metrics?.[metric] == null
														? "—"
														: new Intl.NumberFormat(locale).format(
																metrics[metric],
															)}
												</dd>
											</div>
										))}
									</dl>
									<dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-nb-mute">
										{(["shares", "saves"] as const).map((metric) => (
											<div key={metric} className="flex gap-1">
												<dt>{t(`metrics.${metric}`)}:</dt>
												<dd className="tabular-nums">
													{metrics?.[metric] == null
														? "—"
														: new Intl.NumberFormat(locale).format(
																metrics[metric],
															)}
												</dd>
											</div>
										))}
									</dl>
									<p className="mt-2 text-[10px] leading-relaxed text-nb-mute">
										{metrics
											? t("observedAt", { date: dateTime(snapshot.observedAt) })
											: t(
													account?.canInsights === false
														? "metricsPermission"
														: "noMetrics",
												)}
									</p>
									{delivery.permalink && (
										<a
											href={delivery.permalink}
											target="_blank"
											rel="noreferrer"
											className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold underline"
										>
											{t("openPost")}
											<ArrowUpRight className="size-3" />
										</a>
									)}
								</>
							)}
							{delivery.lastError && (
								<p className="mt-2 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
									{delivery.lastError}
								</p>
							)}
							{id && delivery.status === "outcome_unknown" && (
								<button
									type="button"
									disabled={busy}
									onClick={() => void recover(delivery)}
									className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-nb-line px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
								>
									{delivery.status === "outcome_unknown" ? (
										<AlertCircle className="size-3" />
									) : (
										<RefreshCw className="size-3" />
									)}
									{t(
										delivery.status === "outcome_unknown"
											? "reconcile"
											: "retry",
									)}
								</button>
							)}
						</article>
					);
				})}
				{published.length > 0 && (
					<p className="text-[10px] leading-relaxed text-nb-mute">
						{t("metricsHint")}
					</p>
				)}
			</section>
		</div>
	);
}
