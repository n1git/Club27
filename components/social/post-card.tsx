"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Activity, Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { blockAccount, deletePost, toggleReaction } from "@/lib/actions/social";
import type { ActionState } from "@/lib/actions/types";
import type { FeedPost } from "@/lib/data/social";
import { formatJakartaDate, formatRelativeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Avatar } from "./avatar";
import { PostCommentsSheet } from "./post-comments-sheet";
import { PostMedia } from "./post-media";
import { ReportDialog } from "./report-dialog";

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

function likesLine(count: number, kudos: FeedPost["kudos"]): string | null {
  if (count <= 0) return null;
  const named = [...(kudos.given ? ["Anda"] : []), ...kudos.names];
  if (count !== kudos.count || named.length === 0) return `${count} suka`;
  const rest = count - named.length;
  return `Disukai oleh ${named.join(", ")}${rest > 0 ? ` dan ${rest} lainnya` : ""}`;
}

const ROW = "flex min-h-12 w-full items-center px-4 text-left text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export function PostCard({ post, sportLabels, permalink = false }: { post: FeedPost; sportLabels: Record<string, string>; permalink?: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, start] = useTransition();
  const [reaction, setReaction] = useOptimistic({ mine: post.myReaction, count: post.kudos.count }, (_state, next: { mine: string | null; count: number }) => next);
  const name = post.author?.fullName ?? "Pengguna";
  const longCaption = Boolean(post.body && (post.body.length > 90 || post.body.split("\n").length > 2));
  const likes = likesLine(reaction.count, post.kudos);

  function toggleLike() {
    const kind = reaction.mine ?? "kudos";
    const form = new FormData();
    form.set("postId", post.id);
    form.set("kind", kind);
    start(async () => {
      setReaction(reaction.mine ? { mine: null, count: Math.max(0, reaction.count - 1) } : { mine: "kudos", count: reaction.count + 1 });
      const result = await toggleReaction({}, form);
      if (!result.ok) toast.error(result.error ?? "Gagal memberi reaksi");
    });
  }

  function run(action: (prev: ActionState, form: FormData) => Promise<ActionState>, fields: Record<string, string>, done: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setMenuOpen(false);
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    start(async () => {
      const id = toast.loading("Memproses…");
      const result = await action({}, form);
      if (result.ok) toast.success(result.message ?? done, { id });
      else toast.error(result.error ?? "Gagal memproses", { id });
      router.refresh();
    });
  }

  return (
    <article className="border-b border-border pb-3 sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card sm:pb-4">
      <header className="flex items-center gap-3 px-4 py-2.5">
        {post.author ? (
          <Link href={`/${post.author.username}`} className="shrink-0" aria-label={`Profil ${name}`}>
            <Avatar name={name} src={post.author.avatarUrl} size={36} />
          </Link>
        ) : (
          <Avatar name={name} size={36} />
        )}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          {post.author ? (
            <Link href={`/${post.author.username}`} className="truncate text-sm font-semibold hover:underline">
              {name}
            </Link>
          ) : (
            <span className="truncate text-sm font-semibold">{name}</span>
          )}
          <span className="truncate text-xs text-muted-foreground">
            {post.author ? `@${post.author.username} · ` : ""}
            {permalink ? (
              <span suppressHydrationWarning>{formatRelativeShort(post.createdAt)}</span>
            ) : (
              <Link href={`/p/${post.id}`} className="hover:text-foreground hover:underline" suppressHydrationWarning>
                {formatRelativeShort(post.createdAt)}
              </Link>
            )}
          </span>
        </div>
        <button
          type="button"
          aria-label="Opsi postingan"
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      </header>

      {post.hidden && post.mine ? (
        <p className="mx-4 mb-2 rounded-lg bg-secondary px-3 py-2 text-xs">Postingan ini disembunyikan sementara dari teman karena beberapa laporan sedang ditinjau.</p>
      ) : null}

      {post.kind === "workout" ? (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Latihan {post.sport ? (sportLabels[post.sport] ?? post.sport) : ""}</p>
            <p className="text-xs text-muted-foreground">
              {post.durationMin} menit{post.distanceM ? ` · ${distance(post.distanceM)}` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {post.photos.length ? <PostMedia photos={post.photos} /> : null}

      <div className="flex items-center gap-1 px-2 pt-1">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={Boolean(reaction.mine)}
          aria-label={reaction.mine ? "Batalkan suka" : "Suka"}
          className="flex size-11 items-center justify-center rounded-full ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
        >
          <Heart size={24} aria-hidden="true" className={cn(reaction.mine && "fill-destructive text-destructive")} />
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label="Komentar"
          aria-haspopup="dialog"
          className="flex size-11 items-center justify-center rounded-full ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
        >
          <MessageCircle size={24} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-4 text-sm">
        {likes ? <p className="font-semibold">{likes}</p> : null}
        {post.body ? (
          <div>
            <p className={cn("whitespace-pre-wrap break-words", !expanded && "line-clamp-2")}>
              {post.author ? (
                <Link href={`/${post.author.username}`} className="font-semibold hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="font-semibold">{name}</span>
              )}{" "}
              {post.body}
            </p>
            {longCaption && !expanded ? (
              <button type="button" onClick={() => setExpanded(true)} className="text-muted-foreground hover:text-foreground">
                selengkapnya
              </button>
            ) : null}
          </div>
        ) : null}
        <button type="button" onClick={() => setCommentsOpen(true)} className="w-fit text-muted-foreground hover:text-foreground">
          {post.comments.length ? `Lihat semua ${post.comments.length} komentar` : "Tambah komentar"}
        </button>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          {formatJakartaDate(post.createdAt, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Opsi">
        <ul className="divide-y divide-border">
          {post.mine ? (
            <li>
              <button type="button" className={cn(ROW, "text-destructive")} onClick={() => run(deletePost, { postId: post.id }, "Postingan dihapus", "Hapus postingan ini?")}>
                Hapus postingan
              </button>
            </li>
          ) : post.author ? (
            <>
              <li>
                <ReportDialog targetType="post" targetId={post.id} trigger={<span className={cn(ROW, "cursor-pointer")}>Laporkan</span>} />
              </li>
              <li>
                <button
                  type="button"
                  className={cn(ROW, "text-destructive")}
                  onClick={() =>
                    run(blockAccount, { accountId: post.author!.id }, "Pengguna diblokir", `Blokir ${name}? Pertemanan akan dihapus dan Anda tidak saling melihat konten.`)
                  }
                >
                  Blokir {name}
                </button>
              </li>
            </>
          ) : null}
        </ul>
      </BottomSheet>
      <PostCommentsSheet post={post} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </article>
  );
}
