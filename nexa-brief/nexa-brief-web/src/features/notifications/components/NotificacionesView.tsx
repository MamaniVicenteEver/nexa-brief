"use client";

import { Link } from "@/i18n/navigation";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "../hooks/useNotificationMutations";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../types";
import { NotificationSeverityDot } from "./NotificationSeverityDot";

export function NotificacionesView() {
  const { data, isLoading, isError, isFetching } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-[900px] px-10 pt-22 pb-16">
      <div className="flex items-center justify-between gap-4 pb-4.5">
        <div className="flex items-center gap-2.5">
          <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] text-nb-ink">
            Notificaciones
          </h1>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount} sin leer</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <span className="text-[11.5px] text-nb-mute">Actualizando…</span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Marcar todas como leídas
          </Button>
        </div>
      </div>

      {isError && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          Sin conexión con el servidor — no se pudieron cargar las notificaciones. Reintentando
          automáticamente…
        </div>
      )}

      {isLoading ? (
        <p className="text-[13px] text-nb-mute">Cargando notificaciones…</p>
      ) : notifications.length === 0 ? (
        <p className="text-[13px] text-nb-mute">No hay notificaciones todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.notificationId}
              notification={notification}
              onMarkRead={() => markRead.mutate(notification.notificationId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: AppNotification;
  onMarkRead: () => void;
}) {
  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-[13.5px] font-semibold text-nb-ink">{notification.title}</p>
        <span className="shrink-0 text-[11px] text-nb-mute">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-nb-mute">{notification.message}</p>
    </div>
  );

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
        notification.severity === "error"
          ? "border-destructive/30 bg-destructive/5"
          : cn("border-nb-line", notification.isRead ? "bg-transparent" : "bg-nb-surface"),
      )}
    >
      <NotificationSeverityDot severity={notification.severity} />
      {notification.jobId ? (
        <Link
          href={`/biblioteca/${notification.jobId}`}
          className="min-w-0 flex-1"
          onClick={() => {
            if (!notification.isRead) onMarkRead();
          }}
        >
          {content}
        </Link>
      ) : (
        content
      )}
      {!notification.isRead && (
        <Button variant="ghost" size="sm" onClick={onMarkRead}>
          Marcar leída
        </Button>
      )}
    </li>
  );
}
