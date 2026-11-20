"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { httpClient } from "@/infrastructure/api/http-client";
import { useCategories } from "../hooks/useCategories";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

export function CategoryManager({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (value: boolean) => void;
}) {
	const t = useTranslations("sandbox.production.categories");
	const query = useCategories();
	const client = useQueryClient();
	const [selected, setSelected] = useState("");
	const [name, setName] = useState("");
	const [topic, setTopic] = useState("");
	const [language, setLanguage] = useState("es-419");
	const [deleting, setDeleting] = useState(false);
	const operation = useMutation({
		mutationFn: (remove: boolean) =>
			httpClient(
				`/api/categories${selected ? `/${encodeURIComponent(selected)}` : ""}`,
				{
					method: remove ? "DELETE" : selected ? "PATCH" : "POST",
					sameOrigin: true,
					body: remove ? undefined : { display_name: name, topic, language },
				},
			),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: ["categories"] });
			setSelected("");
			setName("");
			setTopic("");
			setDeleting(false);
		},
	});
	const input =
		"w-full rounded-lg border border-nb-line bg-nb-surface p-2 text-sm";
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!operation.isPending) onOpenChange(value);
			}}
		>
			<DialogContent className="bg-nb-surface sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>
				<select
					aria-label={t("select")}
					className={input}
					value={selected}
					disabled={operation.isPending}
					onChange={(e) => {
						const id = e.target.value;
						const category = query.data?.find((node) => node.id === id);
						setSelected(id);
						setName(category?.displayName ?? "");
						setTopic(category?.topic ?? "");
						setLanguage(
							category?.strategy?.language === "en" ? "en" : "es-419",
						);
						setDeleting(false);
					}}
				>
					<option value="">{t("new")}</option>
					{query.data?.map((node) => (
						<option key={node.id} value={node.id}>
							{node.displayName}
						</option>
					))}
				</select>
				<label className="space-y-1 text-sm">
					{t("name")}
					<input
						className={input}
						value={name}
						disabled={operation.isPending}
						onChange={(e) => setName(e.target.value)}
					/>
				</label>
				<label className="space-y-1 text-sm">
					{t("topic")}
					<input
						className={input}
						value={topic}
						disabled={operation.isPending}
						onChange={(e) => setTopic(e.target.value)}
					/>
				</label>
				<label className="space-y-1 text-sm">
					{t("language")}
					<select
						className={input}
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
					>
						<option value="es-419">Español</option>
						<option value="en">English</option>
					</select>
				</label>
				{operation.isError && (
					<p role="alert" className="text-sm text-red-700">
						{operation.error.message}
					</p>
				)}
				{operation.isSuccess && (
					<p role="status" className="text-sm">
						{t("saved")}
					</p>
				)}
				{deleting && <p className="text-sm">{t("deleteHelp", { name })}</p>}
				<div className="flex gap-2">
					<button
						type="button"
						disabled={operation.isPending || name.trim().length < 2}
						className="rounded-full bg-nb-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
						onClick={() => operation.mutate(false)}
					>
						{selected ? t("save") : t("create")}
					</button>
					{selected && (
						<button
							type="button"
							disabled={operation.isPending}
							className="rounded-full border border-nb-line px-4 py-2 text-sm font-semibold text-red-700"
							onClick={() =>
								deleting ? operation.mutate(true) : setDeleting(true)
							}
						>
							{deleting ? t("confirmDelete") : t("delete")}
						</button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
