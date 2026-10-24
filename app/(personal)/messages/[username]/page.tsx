import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { loadThread } from "@/lib/data/messages";
import { ChatThread } from "@/components/personal/chat-thread";

export const metadata: Metadata = { title: "Pesan" };

export default async function ThreadPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const thread = await loadThread(decodeURIComponent(username).toLowerCase(), profile.accountId);
  if (!thread) notFound();
  return <ChatThread initial={thread} />;
}

export const unstable_dynamicStaleTime = 0;
