import { httpClient } from "@/infrastructure/api/http-client";
import type { AppNotification } from "../types";

interface NotificationResponseDto {
  notification_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  job_id: string | null;
  account_alias: string | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

interface NotificationListResponseDto {
  total: number;
  limit: number;
  offset: number;
  unread_count: number;
  notifications: NotificationResponseDto[];
}

function mapNotification(dto: NotificationResponseDto): AppNotification {
  return {
    notificationId: dto.notification_id,
    type: dto.type as AppNotification["type"],
    severity: dto.severity as AppNotification["severity"],
    title: dto.title,
    message: dto.message,
    jobId: dto.job_id,
    accountAlias: dto.account_alias,
    createdAt: dto.created_at,
    readAt: dto.read_at,
    isRead: dto.is_read,
  };
}

export interface ListNotificationsParams {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
}

export async function listNotifications(
  params: ListNotificationsParams = {},
  signal?: AbortSignal,
): Promise<NotificationsPage> {
  const search = new URLSearchParams();
  if (params.unreadOnly) search.set("unread_only", "true");
  search.set("limit", String(params.limit ?? 20));
  search.set("offset", String(params.offset ?? 0));

  const dto = await httpClient<NotificationListResponseDto>(
    `/api/v1/notifications?${search.toString()}`,
    { signal },
  );
  return {
    notifications: dto.notifications.map(mapNotification),
    total: dto.total,
    unreadCount: dto.unread_count,
  };
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const dto = await httpClient<NotificationResponseDto>(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
  return mapNotification(dto);
}

export async function markAllNotificationsRead(): Promise<number> {
  const dto = await httpClient<{ marked: number }>("/api/v1/notifications/read-all", {
    method: "POST",
  });
  return dto.marked;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await httpClient<void>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, {
    method: "DELETE",
  });
}
