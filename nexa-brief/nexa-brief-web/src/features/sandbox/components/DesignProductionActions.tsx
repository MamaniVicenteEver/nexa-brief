"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
	productionWorkflow,
	type ProductionDraft,
	type ProductionStatus,
} from "../api/production-workflow";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { CategoryManager } from "@/features/categories/components/CategoryManager";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import type { SandboxItem } from "../types";
import { SANDBOX_QUERY_KEY } from "../hooks/useSandbox";

const button =
	"rounded-full border border-nb-line px-4 py-2 text-xs font-semibold disabled:opacity-50";
const input =
	"w-full rounded-lg border border-nb-line bg-nb-surface px-3 py-2 text-sm";

export function DesignProductionActions({ item }: { item: SandboxItem }) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("sandbox.production");
	return (
		<>
			<div className="space-y-2 px-3 py-2">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={`${button} w-full`}
				>
					{t("technicalPrepare")}
				</button>
				<button
					type="button"
					disabled={!item.promotable}
					onClick={() => setOpen(true)}
					className={`${button} w-full`}
				>
					{t("pass")}
				</button>
				{!item.promotable && (
					<p className="text-center text-[10px] text-nb-mute">
						{t("requiresValidation")}
					</p>
				)}
			</div>
			<DesignProductionDialog item={item} open={open} onOpenChange={setOpen} />
		</>
	);
}

export function DesignProductionDialog({
	item,
	open,
	onOpenChange,
}: {
	item: Pick<SandboxItem, "folder" | "id">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("sandbox.production");
	const query = useQuery({
		queryKey: ["design-production", item.folder, item.id],
		enabled: open,
		queryFn: ({ signal }) =>
			productionWorkflow.get(item.folder, item.id, signal),
		refetchInterval: (query) =>
			["queued", "validating"].includes(query.state.data?.state ?? "")
				? 3000
				: false,
	});
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto bg-nb-surface sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>
				{query.isPending && <p>{t("loading")}</p>}
				{query.isError && <p role="alert">{query.error.message}</p>}
				{query.data && (
					<ProductionForm
						key={`${item.folder}/${item.id}`}
						status={query.data}
						onDone={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function ProductionForm({
	status,
	onDone,
}: {
	status: ProductionStatus;
	onDone: () => void;
}) {
	const t = useTranslations("sandbox.production");
	const categories = useCategories();
	const choices = (categories.data ?? []).filter(
		(node) => node.engine === "explainer_kit",
	);
	const [draft, setDraft] = useState<ProductionDraft>(status.draft);
	const [managing, setManaging] = useState(false);
	const client = useQueryClient();
	useEffect(() => {
		if (status.state === "ready")
			void client.invalidateQueries({ queryKey: SANDBOX_QUERY_KEY });
	}, [status.state, client]);
	const mutation = useMutation({
		mutationFn: async (action: "save" | "validate" | "pass" | "discard") => {
			if (action === "discard")
				return productionWorkflow.discard(status.folder, status.project_id);
			if (action === "pass")
				return productionWorkflow.pass(status.folder, status.project_id, draft);
			const saved = await productionWorkflow.save(
				status.folder,
				status.project_id,
				draft,
			);
			return action === "validate"
				? productionWorkflow.validate(status.folder, status.project_id)
				: saved;
		},
		onSuccess: async (result) => {
			setDraft(result.draft);
			client.setQueryData(
				["design-production", status.folder, status.project_id],
				result,
			);
			await Promise.all(
				[
					"explainer-sandbox",
					"showcase-standard",
					"explainer-videos",
					"categories",
					"sandbox-showcase-visibility",
				].map((key) => client.invalidateQueries({ queryKey: [key] })),
			);
			if (result.state === "production") onDone();
		},
	});
	const running =
		mutation.isPending || ["queued", "validating"].includes(status.state);
	const dirty = JSON.stringify(draft) !== JSON.stringify(status.draft);
	function field(name: keyof ProductionDraft, value: unknown) {
		setDraft((current) => ({ ...current, [name]: value }));
	}
	return (
		<div className="space-y-4">
			<p role="status" className="text-sm font-semibold">
				{t(`states.${status.state}`)}
			</p>
			{status.error && (
				<p role="alert" className="text-sm text-red-700">
					{status.error}
				</p>
			)}
			{mutation.isError && (
				<p role="alert" className="text-sm text-red-700">
					{mutation.error.message}
				</p>
			)}
			<fieldset disabled={running} className="space-y-4 disabled:opacity-60">
				<label className="block space-y-1">
					<span className="text-sm font-semibold">{t("designTitle")}</span>
					<input
						className={input}
						value={draft.title}
						onChange={(e) => field("title", e.target.value)}
					/>
				</label>
				<label className="block space-y-1">
					<span className="text-sm font-semibold">
						{t("designDescription")}
					</span>
					<textarea
						className={input}
						rows={3}
						value={draft.description}
						onChange={(e) => field("description", e.target.value)}
					/>
				</label>
				<label className="block space-y-1">
					<span className="text-sm font-semibold">{t("mainCategory")}</span>
					<select
						className={input}
						value={draft.category}
						onChange={(e) => {
							const value = e.target.value;
							setDraft((current) => ({
								...current,
								category: value,
								shared_categories: current.shared_categories.filter(
									(id) => id !== value,
								),
							}));
						}}
					>
						<option value="">{t("chooseCategory")}</option>
						{choices.map((node) => (
							<option key={node.path} value={node.path}>
								{node.displayName}
							</option>
						))}
					</select>
				</label>
				<fieldset className="space-y-2">
					<legend className="text-sm font-semibold">{t("references")}</legend>
					<div className="flex flex-wrap gap-3">
						{choices
							.filter((node) => node.path !== draft.category)
							.map((node) => (
								<label
									key={node.path}
									className="flex items-center gap-2 text-sm"
								>
									<input
										type="checkbox"
										checked={draft.shared_categories.includes(node.path)}
										onChange={(e) =>
											field(
												"shared_categories",
												e.target.checked
													? [...draft.shared_categories, node.path]
													: draft.shared_categories.filter(
															(id) => id !== node.path,
														),
											)
										}
									/>
									{node.displayName}
								</label>
							))}
					</div>
				</fieldset>
				<button
					type="button"
					className={button}
					onClick={() => setManaging(true)}
				>
					{t("manageCategories")}
				</button>
                {(status.styles?.length ?? 0) > 0 && (
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-semibold">{t("posterStyles")}</legend>
                        <p className="text-xs text-nb-mute">{t("reusePosters")}</p>
                        <div className="flex flex-wrap gap-3">
                            {status.styles?.map((style) => (
                                <label key={style.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox"
                                        checked={(draft.poster_styles ?? []).includes(style.id)}
                                        onChange={(e) => field("poster_styles", e.target.checked
                                            ? [...(draft.poster_styles ?? []), style.id]
                                            : (draft.poster_styles ?? []).filter((id) => id !== style.id))} />
                                    {style.name}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

			</fieldset>
            {status.report && <section className="rounded-xl border border-nb-line p-3 text-xs" aria-label={t("technicalReport")}>
                <p>{t("checkedResources", { files: status.report.files_checked, resources: status.report.resources_checked })}</p>
                <p>{t("existingPosters", { existing: status.report.posters.filter((p) => p.exists).length, total: status.report.posters.length })}</p>
                {status.report.issues.map((issue) => <p key={issue} role="alert">{issue}</p>)}
                {status.report.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </section>}
			{status.issues.length > 0 && (
				<details>
					<summary className="cursor-pointer text-xs">
						{t("pending", { count: status.issues.length })}
					</summary>
					<ul className="list-inside list-disc text-xs">
						{status.issues.map((issue) => (
							<li key={issue}>{issue}</li>
						))}
					</ul>
				</details>
			)}
			{status.warnings.length > 0 && (
				<details>
					<summary className="cursor-pointer text-xs">{t("notes")}</summary>
					<ul className="list-inside list-disc text-xs">
						{status.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</details>
			)}
			<p className="text-xs text-nb-mute">{t("demoHelp")}</p>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={running}
					className={button}
					onClick={() => mutation.mutate("save")}
				>
					{t("save")}
				</button>
				<button
					type="button"
					disabled={running || !draft.category || ((status.styles?.length ?? 0) > 0 && !draft.poster_styles?.length)}
					className={button}
					onClick={() => mutation.mutate("validate")}
				>
					{t("validate")}
				</button>
				<button
					type="button"
					disabled={running || !status.can_pass || dirty || categories.isError}
					className={`${button} bg-nb-ink text-white`}
					onClick={() => mutation.mutate("pass")}
				>
					{t("pass")}
				</button>
				<button
					type="button"
					disabled={running}
					className={button}
					onClick={() => mutation.mutate("discard")}
				>
					{t("discard")}
				</button>
			</div>
			<CategoryManager open={managing} onOpenChange={setManaging} />
		</div>
	);
}
