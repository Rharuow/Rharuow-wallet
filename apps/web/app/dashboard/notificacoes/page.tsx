import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type {
  NotificationItem,
  NotificationStatusFilter,
  NotificationType,
} from "@/lib/notifications";
import { NotificationsClient } from "./NotificationsClient";

export const metadata = { title: "Notificações — RharouWallet" };

type SearchParams = Promise<{
  page?: string;
  status?: NotificationStatusFilter;
  type?: NotificationType;
}>;

async function fetchNotifications(
  token: string | null,
  params: { page: number; status: NotificationStatusFilter; type?: NotificationType }
) {
  if (!token) {
    return {
      notifications: [] as NotificationItem[],
      unreadCount: 0,
      total: 0,
      page: params.page,
      limit: 10,
    };
  }

  const query = new URLSearchParams({
    page: String(params.page),
    limit: "10",
    status: params.status,
    ...(params.type ? { type: params.type } : {}),
  });

  const data = await apiFetch<{
    notifications: NotificationItem[];
    unreadCount: number;
    total: number;
    page: number;
    limit: number;
  }>(`/v1/notifications?${query.toString()}`, {
    token,
    cache: "no-store",
  });

  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
    total: data.total ?? 0,
    page: data.page ?? params.page,
    limit: data.limit ?? 10,
  };
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await getAuthToken();
  const sp = await searchParams;
  const currentPage = Math.max(1, Number(sp.page ?? "1") || 1);
  const selectedStatus = sp.status ?? "all";
  const selectedType = sp.type;
  const { notifications, unreadCount, total, page, limit } = await fetchNotifications(token, {
    page: currentPage,
    status: selectedStatus,
    type: selectedType,
  });

  return (
    <NotificationsClient
      notifications={notifications}
      unreadCount={unreadCount}
      total={total}
      currentPage={page}
      totalPages={Math.max(1, Math.ceil(total / Math.max(limit, 1)))}
      selectedStatus={selectedStatus}
      selectedType={selectedType}
    />
  );
}