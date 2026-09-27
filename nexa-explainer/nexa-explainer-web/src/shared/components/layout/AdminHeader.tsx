"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
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

export function AdminHeader() {
  const t = useTranslations("adminNav");
  const pathname = usePathname();

  const MANAGEMENT_LINKS = [
    { href: "/programacion", label: t("programacion") },
    { href: "/biblioteca", label: t("biblioteca") },
    { href: "/historial", label: t("historial") },
    { href: "/notificaciones", label: t("notificaciones") },
  ] as const;

  const isManagementActive = MANAGEMENT_LINKS.some((link) => pathname === link.href);

  return (
    <nav className="nb-glass-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between px-10 py-[22px]">
      <Link
        href="/dashboard"
        className="font-nb-sans text-[22px] font-bold tracking-[-0.03em] text-nb-ink no-underline"
      >
        {t("brand")}
      </Link>

      <ul className="absolute left-1/2 flex -translate-x-1/2 gap-4 text-[12.5px]">
        <li>
          <Link
            href="/dashboard"
            className={cn(
              "relative inline-flex items-center gap-1 px-0.5 py-1 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
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
              "relative inline-flex items-center gap-1 px-0.5 py-1 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
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
              "relative inline-flex items-center gap-1 px-0.5 py-1 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
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
              "relative inline-flex items-center gap-1 px-0.5 py-1 font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink",
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
                  "relative inline-flex items-center gap-1 px-0.5 py-1 font-medium text-nb-ink-soft transition-colors hover:text-nb-ink",
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

      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <NotificationBell />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="nb-btn-pill px-7 py-[13px] font-nb-sans text-sm font-medium"
        >
          {t("salir")}
        </button>
      </div>
    </nav>
  );
}
