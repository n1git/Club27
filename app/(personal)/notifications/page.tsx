import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getNotifications } from "@/lib/data/notifications";
import { NotificationList } from "@/components/personal/notification-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function NotificationsPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const items = await getNotifications(profile.accountId);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="hidden sm:block">
        <PageHeader title="Notifikasi" />
      </div>
      <h1 className="text-xl font-semibold sm:hidden">Notifikasi</h1>
      <NotificationList items={items} />
    </div>
  );
}
