export type NotificationType = "video_ready" | "video_failed" | "token_expired";

export type NotificationSeverity = "info" | "warning" | "error";

export interface AppNotification {
  notificationId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  jobId: string | null;
  accountAlias: string | null;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}
