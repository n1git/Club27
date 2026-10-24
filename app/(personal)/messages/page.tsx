import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getInbox } from "@/lib/data/messages";
import { InboxList } from "@/components/personal/inbox-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Pesan" };

export default async function MessagesPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const items = await getInbox(profile.accountId);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="hidden sm:block">
        <PageHeader title="Pesan" />
      </div>
      <h1 className="text-xl font-semibold sm:hidden">Pesan</h1>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Belum ada percakapan. Buka{" "}
          <Link href="/friends" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            daftar teman
          </Link>{" "}
          lalu pilih Kirim pesan.
        </p>
      ) : (
        <InboxList items={items} />
      )}
    </div>
  );
}
