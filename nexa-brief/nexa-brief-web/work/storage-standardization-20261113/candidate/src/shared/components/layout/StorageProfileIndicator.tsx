"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { httpClient } from "@/infrastructure/api/http-client";

export function StorageProfileIndicator() {
  const t = useTranslations("adminNav");
  const { data } = useQuery({
    queryKey: ["storage-profile"],
    queryFn: () => httpClient<{ id: string; label: string }>("/api/v1/storage/profile"),
    staleTime: 60_000,
    retry: false,
  });
  if (!data || data.id === "legacy") return null;
  return (
    <span className="hidden rounded-full bg-nb-green/10 px-2 py-1 text-[10px] font-semibold text-nb-green-dark 2xl:inline-flex">
      {t("storageProfile", { name: data.label })}
    </span>
  );
}
