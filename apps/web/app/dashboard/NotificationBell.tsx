"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AsideSheet, Button, Card, useToast } from "rharuow-ds";
import { useRouter } from "next/navigation";
import {
  formatNotificationDate,
  notificationActionLabel,
  type NotificationItem,
} from "@/lib/notifications";

type NotificationsSocketTokenResponse = {
  token?: string;
  expiresInSeconds?: number;
  error?: string;
};

type NotificationsSocketMessage = {
  type?: string;
  unreadCount?: number;
};

function buildNotificationsSocketUrl(token: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const wsBase = apiBase.replace(/^http/, "ws");
  return `${wsBase}/v1/notifications/ws?token=${encodeURIComponent(token)}`;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 17H9" />
      <path d="M18 17H6c1.1-1.2 2-2.6 2-4.5V10a4 4 0 1 1 8 0v2.5c0 1.9.9 3.3 2 4.5Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

type NotificationsResponse = {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
};

export function NotificationBell() {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempt = 0;

    async function loadUnreadCountFallback() {
      try {
        const response = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!cancelled && response.ok) {
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        return;
      }
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimeout !== null) {
        return;
      }

      const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt, 4));
      reconnectAttempt += 1;
      reconnectTimeout = window.setTimeout(() => {
        reconnectTimeout = null;
        void connect();
      }, delay);
    }

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/notifications/socket-token", {
          cache: "no-store",
        });
        const tokenData = (await tokenResponse.json().catch(() => ({}))) as NotificationsSocketTokenResponse;

        if (!tokenResponse.ok || !tokenData.token) {
          await loadUnreadCountFallback();
          scheduleReconnect();
          return;
        }

        socket = new WebSocket(buildNotificationsSocketUrl(tokenData.token));

        socket.addEventListener("open", () => {
          reconnectAttempt = 0;
        });

        socket.addEventListener("message", (event) => {
          if (cancelled) {
            return;
          }

          const data = JSON.parse(String(event.data)) as NotificationsSocketMessage;
          if (data.type === "notifications.unread_count") {
            setUnreadCount(data.unreadCount ?? 0);
          }
        });

        socket.addEventListener("error", () => {
          socket?.close();
        });

        socket.addEventListener("close", () => {
          socket = null;
          if (!cancelled) {
            void loadUnreadCountFallback();
            scheduleReconnect();
          }
        });
      } catch {
        await loadUnreadCountFallback();
        scheduleReconnect();
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      socket?.close();
    };
  }, [mounted]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=5", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as NotificationsResponse;

      if (!response.ok) {
        toast.error("Erro ao carregar notificações");
        return;
      }

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  }

  async function markAllAsRead() {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
    });

    if (!response.ok) {
      toast.error("Erro ao marcar notificações como lidas");
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
    router.refresh();
  }

  async function markAsRead(notificationId: string) {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
    });

    if (!response.ok) {
      toast.error("Erro ao marcar notificação como lida");
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    router.refresh();
  }

  async function respondToInvite(notification: NotificationItem, action: "accept" | "decline") {
    const inviteToken = notification.data?.inviteToken;

    if (!inviteToken) {
      toast.error("Convite sem token válido para esta ação");
      return;
    }

    setActingId(notification.id);

    try {
      const response = await fetch(`/api/wallet/invites/${inviteToken}/${action}`, {
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
        setOpen(false);
        router.push("/dashboard/custos");
        router.refresh();
        return;
      }

      await loadNotifications();
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <>
      <Button
        variant="icon"
        className="relative rounded-xl border border-slate-200 bg-white/90 p-0 shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] border-[var(--primary)] text-[var(--primary)]"
        aria-label="Abrir notificações"
        onClick={() => void toggleOpen()}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <AsideSheet open={open} onClose={() => setOpen(false)} size="sm">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <p className="text-sm font-semibold">Notificações</p>
              <p className="text-xs">
                {unreadCount > 0
                  ? `${unreadCount} atualização(ões) pendente(s)`
                  : "Tudo em dia por enquanto"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0}
            >
              Marcar todas
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm">Carregando notificações...</p>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm">
                Nenhuma notificação no momento.
              </div>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`rounded-2xl border transition-colors ${
                    notification.readAt
                      ? "border-slate-200 bg-slate-50"
                      : "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                  }`}
                >
                  <Card.Body className="p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.readAt ? "bg-slate-300" : "bg-[var(--primary)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-5 text-[var(--foreground)]">
                          {notificationActionLabel(notification.type)}
                        </p>
                        <p className="mt-1 text-sm leading-5">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                          {!notification.readAt ? (
                            <button
                              type="button"
                              onClick={() => void markAsRead(notification.id)}
                              className="text-xs font-medium text-[var(--secondary)] transition-colors hover:text-[var(--primary-hover)]"
                            >
                              Marcar como lida
                            </button>
                          ) : null}
                        </div>
                        {notification.type === "WALLET_INVITE_SENT" && !notification.readAt ? (
                          <div className="mt-3 flex flex-wrap gap-2">
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
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          <Link
            href="/dashboard/notificacoes"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 pt-3 text-center text-sm font-medium text-white hover:underline"
          >
            Ver todas as notificações
          </Link>
        </div>
      </AsideSheet>
    </>
  );
}