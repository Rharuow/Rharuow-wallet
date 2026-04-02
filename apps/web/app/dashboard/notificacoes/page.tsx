import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { NotificationItem } from "@/lib/notifications";
import { NotificationsClient } from "./NotificationsClient";

export const metadata = { title: "Notificações — RharouWallet" };

async function fetchNotifications(token: string | null) {
  if (!token) {
    return {
      notifications: [] as NotificationItem[],
      unreadCount: 0,
    };
  }

  const data = await apiFetch<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>("/v1/notifications?limit=50", {
    token,
    cache: "no-store",
  });

  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
  };
}

export default async function NotificationsPage() {
  const token = await getAuthToken();
  const { notifications, unreadCount } = await fetchNotifications(token);

  return (
    <NotificationsClient
      notifications={notifications}
      unreadCount={unreadCount}
    />
  );
}