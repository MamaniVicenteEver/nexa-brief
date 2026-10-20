"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useJobTechnical } from "../../hooks/useJobTechnical";
import { EMPTY_VALUE } from "./sidebar-shared";
import { buildTechnicalSections, type TechnicalSection } from "./technical-rows";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Pestaña "Info técnica": tabla dato | valor con el motor, los tiempos y lo que
 * ffprobe mide de cada archivo. Lo que no se guardó se muestra como "—". */
export function TechnicalTab({ jobId, categoryLabel }: { jobId: string; categoryLabel: string }) {
  const t = useTranslations("library.playerSidebar.technical");
  const { data, isLoading, isError } = useJobTechnical(jobId);

  if (isLoading) {
    return <div className="h-80 animate-pulse rounded-xl bg-nb-bg-2" />;
  }
  if (isError || !data) {
    return <p className="text-[12.5px] text-red-600">{t("error")}</p>;
  }

  const sections = buildTechnicalSections(data, categoryLabel, formatDate);
  return (
    <table className="w-full table-fixed border-collapse text-[12px]">
      <thead>
        <tr className="text-left text-[10.5px] tracking-[0.04em] text-nb-mute uppercase">
          <th scope="col" className="w-[42%] pb-1.5 font-semibold">
            {t("columns.field")}
          </th>
          <th scope="col" className="pb-1.5 font-semibold">
            {t("columns.value")}
          </th>
        </tr>
      </thead>
      {sections.map((section) => (
        <SectionBody key={section.fileKey ?? "general"} section={section} />
      ))}
    </table>
  );
}

function SectionBody({ section }: { section: TechnicalSection }) {
  const t = useTranslations("library.playerSidebar.technical");
  return (
    <tbody>
      {section.fileKey && (
        <tr>
          <th
            scope="colgroup"
            colSpan={2}
            className="pt-4 pb-1.5 text-left text-[11px] font-semibold tracking-[0.05em] text-nb-ink uppercase"
          >
            {t(`files.${section.fileKey}`)}
            {section.fileName && (
              <span className="ml-1.5 font-mono text-[10.5px] font-normal tracking-normal text-nb-mute normal-case">
                {section.fileName}
              </span>
            )}
          </th>
        </tr>
      )}
      {section.rows.map((row) => {
        const value = row.valueKey ? t(row.valueKey) : row.value;
        return (
          <tr key={row.label} className="border-t border-nb-line align-top">
            <th scope="row" className="py-1.5 pr-2 text-left font-medium text-nb-mute">
              {t(`rows.${row.label}`)}
            </th>
            <td
              className={cn(
                "py-1.5 break-words whitespace-pre-line text-nb-ink",
                row.mono && value && "font-mono text-[11px]",
              )}
            >
              {value || EMPTY_VALUE}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
