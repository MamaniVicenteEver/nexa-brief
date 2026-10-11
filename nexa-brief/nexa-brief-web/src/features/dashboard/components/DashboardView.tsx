"use client";

import { CalendarDays, Library, Plus, RadioTower } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboardSummary } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { ActivityPanel } from "./ActivityPanel";
import { AlertsPanel } from "./AlertsPanel";
import { CatalogStrip } from "./CatalogStrip";
import { CategoriesPanel } from "./CategoriesPanel";
import { ChannelsPanel } from "./ChannelsPanel";
import { KpiRow } from "./KpiRow";
import { PerformancePanel } from "./PerformancePanel";
import { PublicationsPanel } from "./PublicationsPanel";
import { UpcomingPanel } from "./UpcomingPanel";

/** Panel de control: una sola lectura (GET /dashboard/summary) repartida en
 * bloques independientes. Cada bloque recibe solo su sección, así se puede
 * mover, quitar o testear sin tocar los demás. */
export function DashboardView({ userName }: { userName: string | null }) {
  const t = useTranslations("dashboard");
  const { data, isLoading, isError } = useDashboardSummary();

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-22 pb-20 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="nb-eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-2 font-nb-sans text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.03em] text-nb-ink">
            {userName ? t("greeting", { name: userName }) : t("heading")}
          </h1>
          <p className="mt-1 text-[13.5px] text-nb-mute">{t("subtitle")}</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link
            href="/crear-video"
            className="nb-btn-pill inline-flex items-center gap-1.5 px-4.5 py-2.5 text-[13px] font-semibold"
          >
            <Plus className="size-4" />
            {t("actions.create")}
          </Link>
          {[
            { href: "/biblioteca?tab=pendientes", Icon: Library, label: t("actions.library") },
            { href: "/programacion", Icon: CalendarDays, label: t("actions.schedule") },
            { href: "/canales", Icon: RadioTower, label: t("actions.channels") },
          ].map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold no-underline"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <p className="mt-10 rounded-[24px] border border-dashed border-nb-line px-6 py-14 text-center text-[13.5px] text-nb-mute">
          {t("loadError")}
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          <KpiRow videos={data.videos} />
          <AlertsPanel alerts={data.alerts} />
          <CategoriesPanel />
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <ChannelsPanel channels={data.channelList} />
            <PublicationsPanel publications={data.publications} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <ActivityPanel activity={data.activity} />
            <div className="flex flex-col gap-5">
              <UpcomingPanel upcoming={data.upcoming} />
              <PerformancePanel performance={data.performance} />
            </div>
          </div>
          <CatalogStrip catalog={data.catalog} videos={data.videos} />
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-8 flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos sin identidad
          <div key={i} className="h-[92px] animate-pulse rounded-[20px] bg-nb-bg-2" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="h-[260px] animate-pulse rounded-[24px] bg-nb-bg-2" />
        <div className="h-[260px] animate-pulse rounded-[24px] bg-nb-bg-2" />
      </div>
    </div>
  );
}
