export type NotificationType =
  | "WALLET_INVITE_SENT"
  | "WALLET_INVITE_ACCEPTED"
  | "WALLET_INVITE_DECLINED"
  | "WALLET_INVITE_REVOKED";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    inviteId?: string;
    inviteToken?: string;
    ownerId?: string;
    ownerName?: string | null;
    ownerEmail?: string;
    guestId?: string;
    guestName?: string | null;
    guestEmail?: string;
    permission?: "READ" | "FULL";
  } | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function formatNotificationDate(value: string) {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function notificationActionLabel(type: NotificationType) {
  switch (type) {
    case "WALLET_INVITE_SENT":
      return "Convite recebido";
    case "WALLET_INVITE_ACCEPTED":
      return "Convite aceito";
    case "WALLET_INVITE_DECLINED":
      return "Convite recusado";
    case "WALLET_INVITE_REVOKED":
      return "Acesso revogado";
    default:
      return "Notificação";
  }
}