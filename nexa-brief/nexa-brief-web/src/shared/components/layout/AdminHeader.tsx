"use client";

import { ChevronDownIcon, LogOutIcon, MenuIcon } from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/features/notifications";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { StorageProfileIndicator } from "./StorageProfileIndicator";

export function AdminHeader() {
  const t = useTranslations("adminNav");
  // "Recursos" vive en su propio archivo de mensajes (messages/*/resources.json).
  const tResources = useTranslations("resources");
  const tShowcase = useTranslations("showcase");
  const pathname = usePathname();

  const MANAGEMENT_LINKS = [
    { href: "/programacion", label: t("programacion") },
    { href: "/biblioteca", label: t("biblioteca") },
    { href: "/recursos", label: tResources("navLabel") },
    { href: "/showcase", label: tShowcase("navLabel") },
    { href: "/historial", label: t("historial") },
    { href: "/notificaciones", label: t("notificaciones") },
  ] as const;

  const isManagementActive = MANAGEMENT_LINKS.some((link) => pathname === link.href);

  return (
    <nav className="nb-glass-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 px-3 py-1 sm:px-6 2xl:px-10">
      <Link
        href="/dashboard"
        aria-label={t("brand")}
        className="inline-flex shrink-0 items-center gap-0 font-nb-sans text-[17px] font-bold tracking-[-0.03em] whitespace-nowrap text-nb-ink no-underline sm:text-[20px]"
      >
        <Image
          src="/logo/nexa-mark-bw-transparent.png"
          alt=""
          width={56}
          height={56}
          className="size-10 shrink-0 object-contain sm:size-12 md:size-14"
        />
        <span className="-ml-1" aria-hidden="true">
          exa Brief
        </span>
      </Link>

      <ul className="absolute left-1/2 hidden -translate-x-1/2 gap-3 text-[12px] 2xl:flex">
        <li>
          <Link
            href="/dashboard"
            className={cn(
              "relative inline-flex items-center gap-1 px-0.5 py-0.5 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
              pathname === "/dashboard" &&
                "text-nb-ink after:absolute after:-bottom-1.5 after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-nb-green-dark",
            )}
          >
            {t("dashboard")}
          </Link>
        </li>
        <li>
          <Link
            href="/crear-video"
            className={cn(
              "relative inline-flex items-center gap-1 px-0.5 py-0.5 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
              pathname === "/crear-video" &&
                "text-nb-ink after:absolute after:-bottom-1.5 after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-nb-green-dark",
            )}
          >
            {t("crearVideo")}
          </Link>
        </li>
        <li>
          <Link
            href="/plantillas"
            className={cn(
              "relative inline-flex items-center gap-1 px-0.5 py-0.5 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
              (pathname === "/plantillas" || pathname.startsWith("/plantillas/")) &&
                "text-nb-ink after:absolute after:-bottom-1.5 after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-nb-green-dark",
            )}
          >
            {t("plantillas")}
          </Link>
        </li>
        <li>
          <Link
            href="/canales"
            className={cn(
              "relative inline-flex items-center gap-1 px-0.5 py-0.5 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
              pathname === "/canales" &&
                "text-nb-ink after:absolute after:-bottom-1.5 after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-nb-green-dark",
            )}
          >
            {t("canales")}
          </Link>
        </li>
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-flex items-center gap-1 px-0.5 py-0.5 font-medium text-nb-ink-soft transition-colors hover:text-nb-ink",
                  isManagementActive &&
                    "text-nb-ink after:absolute after:-bottom-1.5 after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-nb-green-dark",
                )}
              >
                {t("gestion")} <ChevronDownIcon className="size-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[190px] rounded-[14px] p-2">
              {MANAGEMENT_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href} className="text-[13.5px] font-medium">
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {process.env.NODE_ENV === "development" && (
          <span className="hidden rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 2xl:inline">
            {t("developmentEnvironment")}
          </span>
        )}
        <div className="hidden 2xl:block">
          <StorageProfileIndicator />
        </div>
        <div className="2xl:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("gestion")}
                className="flex size-8 items-center justify-center rounded-full border border-nb-line bg-nb-surface text-nb-ink"
              >
                <MenuIcon size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[80dvh] min-w-[210px] overflow-y-auto rounded-2xl p-2"
            >
              {[
                { href: "/dashboard", label: t("dashboard") },
                { href: "/crear-video", label: t("crearVideo") },
                { href: "/plantillas", label: t("plantillas") },
                { href: "/canales", label: t("canales") },
                ...MANAGEMENT_LINKS,
              ].map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className="text-[13px] font-medium"
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-nb-line px-2 pt-3 pb-1">
                {process.env.NODE_ENV === "development" && (
                  <span className="text-[10px] font-semibold text-amber-800">
                    {t("developmentEnvironment")}
                  </span>
                )}
                <StorageProfileIndicator />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <LocaleSwitcher />
        <NotificationBell />
        <button
          type="button"
          aria-label={t("salir")}
          title={t("salir")}
          onClick={() => signOut({ callbackUrl: "/" })}
          className="nb-btn-pill inline-flex size-9 items-center justify-center p-0"
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">{t("salir")}</span>
        </button>
      </div>
    </nav>
  );
}
