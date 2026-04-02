"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, useToast } from "rharuow-ds";
import {
  formatNotificationDate,
  notificationActionLabel,
  type NotificationItem,
} from "@/lib/notifications";

type Props = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function NotificationsClient({ notifications, unreadCount }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function markAsRead(notificationId: string) {
    setActingId(notificationId);
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao marcar notificação como lida");
        return;
      }

      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function deleteNotification(notificationId: string) {
    setActingId(notificationId);
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao excluir notificação");
        return;
      }

      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function markAllAsRead() {
    setBulkLoading(true);
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao marcar notificações como lidas");
        return;
      }

      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  }

  async function respondToInvite(notification: NotificationItem, action: "accept" | "decline") {
    const token = notification.data?.inviteToken;
    if (!token) {
      toast.error("Convite sem token válido para esta ação");
      return;
    }

    setActingId(notification.id);
    try {
      const response = await fetch(`/api/wallet/invites/${token}/${action}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao processar convite");
        return;
      }

      await fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" });

      if (action === "accept" && notification.data?.ownerId) {
        await fetch("/api/wallet/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: notification.data.ownerId }),
        });
        router.push("/dashboard/custos");
        router.refresh();
        return;
      }

      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Notificações</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount > 0
              ? `${unreadCount} notificação(ões) não lidas.`
              : "Você está em dia com as notificações."}
          </p>
        </div>
        <Button variant="outline" onClick={markAllAsRead} disabled={bulkLoading || unreadCount === 0}>
          {bulkLoading ? "Marcando..." : "Marcar todas como lidas"}
        </Button>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-slate-500">Nenhuma notificação no momento.</p>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${
                        notification.readAt ? "bg-slate-300" : "bg-[var(--primary)]"
                      }`}
                    />
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {notificationActionLabel(notification.type)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">{notification.message}</p>
                  <p className="text-xs text-slate-400">
                    {formatNotificationDate(notification.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {notification.type === "WALLET_INVITE_SENT" && !notification.readAt ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void respondToInvite(notification, "accept")}
                        disabled={actingId === notification.id}
                      >
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void respondToInvite(notification, "decline")}
                        disabled={actingId === notification.id}
                      >
                        Recusar
                      </Button>
                    </>
                  ) : null}

                  {!notification.readAt ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void markAsRead(notification.id)}
                      disabled={actingId === notification.id}
                    >
                      Marcar como lida
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void deleteNotification(notification.id)}
                    disabled={actingId === notification.id}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}