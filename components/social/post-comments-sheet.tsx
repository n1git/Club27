"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/lib/actions/social";
import type { FeedComment, FeedPost } from "@/lib/data/social";
import { formatRelativeShort } from "@/lib/format";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Avatar } from "./avatar";
import { ReportDialog } from "./report-dialog";

type Row = FeedComment & { pending?: boolean };

export function PostCommentsSheet({ post, open, onClose }: { post: FeedPost; open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const [rows, change] = useOptimistic<Row[], { add?: Row; remove?: string }>(post.comments, (state, next) =>
    next.add ? [...state, next.add] : state.filter((c) => c.id !== next.remove),
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    const form = new FormData();
    form.set("postId", post.id);
    form.set("body", body);
    start(async () => {
      change({ add: { id: `tmp-${Date.now()}`, author: null, body, createdAt: new Date().toISOString(), mine: true, pending: true } });
      const result = await addComment({}, form);
      if (!result.ok) {
        setText(body);
        toast.error(result.error ?? "Gagal mengirim komentar");
      }
    });
  }

  function remove(id: string) {
    const form = new FormData();
    form.set("commentId", id);
    start(async () => {
      change({ remove: id });
      const result = await deleteComment({}, form);
      if (!result.ok) toast.error(result.error ?? "Gagal menghapus komentar");
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Komentar">
      <div className="flex min-h-[40dvh] flex-col">
        <ul className="flex flex-1 flex-col gap-4 p-4">
          {rows.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">Belum ada komentar. Mulai percakapan.</li> : null}
          {rows.map((c) => (
            <li key={c.id} className={c.pending ? "flex gap-3 opacity-60" : "flex gap-3"}>
              <Avatar name={c.author?.fullName ?? "Anda"} src={c.author?.avatarUrl} size={32} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words">
                  {c.author ? (
                    <Link href={`/${c.author.username}`} className="font-semibold hover:underline">
                      {c.author.fullName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{c.mine ? "Anda" : "Pengguna"}</span>
                  )}{" "}
                  {c.body}
                </p>
                <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span suppressHydrationWarning>{c.pending ? "Mengirim…" : formatRelativeShort(c.createdAt)}</span>
                  {c.pending || c.mine || post.mine ? null : <ReportDialog targetType="comment" targetId={c.id} />}
                </p>
              </div>
              {!c.pending && (c.mine || post.mine) ? (
                <button
                  type="button"
                  aria-label="Hapus komentar"
                  onClick={() => remove(c.id)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <form
          onSubmit={submit}
          className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Tulis komentar…"
            aria-label="Komentar"
            className="h-11 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-accent-foreground ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            Kirim
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
