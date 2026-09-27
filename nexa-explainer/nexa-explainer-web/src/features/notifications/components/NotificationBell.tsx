"use client";

import { BellIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useMarkNotificationRead } from "../hooks/useNotificationMutations";
import { useNotifications } from "../hooks/useNotifications";

const PREVIEW_LIMIT = 5;

export function NotificationBell() {
  const { data } = useNotifications({ limit: PREVIEW_LIMIT });
  const markRead = useMarkNotificationRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative inline-flex size-8 items-center justify-center rounded-full text-nb-ink-soft transition-colors hover:text-nb-ink"
        >
          <BellIcon className="size-[18px]" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[320px] rounded-[14px] p-2">
        <DropdownMenuLabel className="text-[12px] text-nb-mute">Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] text-nb-mute">No hay notificaciones.</p>
        ) : (
          notifications.map((notification) => {
            const itemClassName = cn(
              "flex flex-col items-start gap-0.5 whitespace-normal py-2",
              notification.severity === "error" && "bg-destructive/5",
            );
            const itemContent = (
              <>
                <span
                  className={cn(
                    "text-[13px] font-medium text-nb-ink",
                    notification.isRead && "font-normal text-nb-ink-soft",
                  )}
                >
                  {notification.title}
                </span>
                <span className="text-[11.5px] text-nb-mute">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </>
            );

            if (notification.jobId) {
              return (
                <DropdownMenuItem
                  key={notification.notificationId}
                  className={itemClassName}
                  asChild
                >
                  <Link
                    href={`/biblioteca/${notification.jobId}`}
                    onClick={() => {
                      if (!notification.isRead) markRead.mutate(notification.notificationId);
                    }}
                  >
                    {itemContent}
                  </Link>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={notification.notificationId}
                className={itemClassName}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!notification.isRead) markRead.mutate(notification.notificationId);
                }}
              >
                {itemContent}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notificaciones" className="justify-center text-[12.5px] font-medium">
            Ver todas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
