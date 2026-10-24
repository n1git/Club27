"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { respondFriend } from "@/lib/actions/social";
import type { NotificationItem } from "@/lib/data/notifications";
import { formatRelativeShort } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { Avatar } from "@/components/social/avatar";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function names(item: NotificationItem) {
  const first = item.actors[0]?.fullName ?? "Seseorang";
  const rest = item.actorCount - 1;
  if (rest <= 0) return first;
  if (item.actors.length >= 2 && rest === 1) return `${first} dan ${item.actors[1].fullName}`;
  return `${first} dan ${rest} lainnya`;
}

function message(item: NotificationItem) {
  switch (item.type) {
    case "friend_request":
      return "mengirim permintaan pertemanan.";
    case "friend_accepted":
      return "menerima permintaan pertemanan Anda.";
    case "post_reaction":
      return "menyukai postingan Anda.";
    case "post_comment":
      return item.commentBody ? `mengomentari postingan Anda: ${item.commentBody}` : "mengomentari postingan Anda.";
    case "group_invite":
      return `mengundang Anda ke grup ${item.groupName ?? ""}.`.replace(" .", ".");
  }
}

function href(item: NotificationItem) {
  if (item.postId) return `/p/${item.postId}`;
  if (item.groupId) return `/g/${item.groupId}`;
  const actor = item.actors[0];
  return actor ? `/${actor.username}` : "/friends";
}

function Row({ item, fresh }: { item: NotificationItem; fresh: boolean }) {
  const actor = item.actors[0];
  return (
    <li className={fresh ? "relative flex items-center gap-3 bg-accent/60 px-4 py-3" : "relative flex items-center gap-3 px-4 py-3"}>
      <Avatar name={actor?.fullName ?? "Seseorang"} src={actor?.avatarUrl} size={44} />
      <div className="min-w-0 flex-1 text-sm">
        <Link href={href(item)} className="line-clamp-3 break-words after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
          <span className="font-semibold">{names(item)}</span> {message(item)}{" "}
          <span className="text-muted-foreground" suppressHydrationWarning>
            {formatRelativeShort(item.createdAt)}
          </span>
        </Link>
        {item.type === "friend_request" && item.friendshipId ? (
          <div className="relative z-10 mt-2 flex gap-2">
            <ActionButton action={respondFriend} fields={{ friendshipId: item.friendshipId, accept: "1" }} label="Terima" variant="default" />
            <ActionButton action={respondFriend} fields={{ friendshipId: item.friendshipId, accept: "0" }} label="Tolak" />
          </div>
        ) : null}
      </div>
      {item.thumbUrl ? <img src={item.thumbUrl} alt="" width={44} height={44} loading="lazy" className="size-11 shrink-0 rounded-md bg-secondary object-cover" /> : null}
    </li>
  );
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [fresh] = useState(() => new Set(items.filter((i) => i.unread).map((i) => i.key)));
  const [now] = useState(() => Date.now());
  const [, start] = useTransition();
  const newest = items.filter((i) => i.unread).reduce((max, i) => (i.createdAt > max ? i.createdAt : max), "");

  useEffect(() => {
    if (!newest) return;
    start(async () => {
      await markNotificationsRead(newest);
    });
  }, [newest]);

  if (items.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Belum ada notifikasi. Reaksi, komentar, dan permintaan pertemanan akan muncul di sini.</p>;
  }

  const groups = [
    { title: "Baru", items: items.filter((i) => fresh.has(i.key)) },
    { title: "Minggu ini", items: items.filter((i) => !fresh.has(i.key) && now - Date.parse(i.createdAt) < WEEK_MS) },
    { title: "Sebelumnya", items: items.filter((i) => !fresh.has(i.key) && now - Date.parse(i.createdAt) >= WEEK_MS) },
  ].filter((g) => g.items.length);

  return (
    <div className="-mx-4 flex flex-col gap-4 sm:mx-0">
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`notif-${g.title}`}>
          <h2 id={`notif-${g.title}`} className="px-4 pb-1 text-sm font-semibold">
            {g.title}
          </h2>
          <ul className="divide-y divide-border sm:overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-card">
            {g.items.map((item) => (
              <Row key={item.key} item={item} fresh={g.title === "Baru"} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
