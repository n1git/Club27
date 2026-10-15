export const PLATFORM_SUBSCRIPTION_STATUSES = ["pending_verification", "pending", "trial", "active", "expired", "suspended", "cancelled"] as const;

export type PlatformSubscriptionStatus = (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];

export const STATUS_LABEL: Record<PlatformSubscriptionStatus, string> = {
  pending_verification: "Menunggu verifikasi email",
  pending: "Menunggu aktivasi",
  trial: "Trial",
  active: "Aktif",
  expired: "Berakhir",
  suspended: "Ditangguhkan",
  cancelled: "Dibatalkan",
};
