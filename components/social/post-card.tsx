"use client";

import { addComment, blockAccount, deleteComment, deletePost, toggleReaction } from "@/lib/actions/social";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatJakartaDateTime } from "@/lib/format";
import type { FeedPost } from "@/lib/data/social";
import { ReportDialog } from "./report-dialog";

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

function kudosLine({ given, names, others }: FeedPost["kudos"]): string | null {
  const parts = [...(given ? ["Kamu"] : []), ...names];
  if (parts.length === 0 && others === 0) return null;
  const list = parts.join(", ");
  if (others > 0) return `Kudos dari ${list ? `${list} dan ` : ""}${others} lainnya`;
  return `Kudos dari ${list}`;
}

function name(author: { fullName: string; username: string } | null) {
  return author ? author.fullName : "Pengguna";
}

export function PostCard({ post, sportLabels }: { post: FeedPost; sportLabels: Record<string, string> }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col text-sm">
            <span className="font-medium">{name(post.author)}</span>
            <span className="text-xs text-muted-foreground">
              {post.author ? `@${post.author.username} · ` : ""}
              {formatJakartaDateTime(post.createdAt)}
            </span>
          </div>
          {post.mine ? (
            <ActionButton action={deletePost} fields={{ postId: post.id }} label="Hapus" variant="ghost" confirmMessage="Hapus postingan ini?" />
          ) : null}
        </div>
        {post.kind === "workout" ? (
          <p className="text-sm font-medium">
            Latihan {post.sport ? (sportLabels[post.sport] ?? post.sport) : ""}: {post.durationMin} menit
            {post.distanceM ? `, ${distance(post.distanceM)}` : ""}
          </p>
        ) : null}
        {post.body ? <p className="whitespace-pre-wrap break-words text-sm">{post.body}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            action={toggleReaction}
            fields={{ postId: post.id, liked: post.kudos.given ? "1" : "0" }}
            label={`${post.kudos.given ? "Batal kudos" : "Beri kudos"} · ${post.kudos.count}`}
            variant={post.kudos.given ? "secondary" : "outline"}
          />
          {post.mine || !post.author ? null : <ReportDialog targetType="post" targetId={post.id} />}
        </div>
        {kudosLine(post.kudos) ? <p className="text-xs text-muted-foreground">{kudosLine(post.kudos)}</p> : null}
        {post.comments.length ? (
          <ul className="flex flex-col gap-2 border-t border-dashed border-border pt-3 text-sm">
            {post.comments.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 break-words">
                  <span className="font-medium">{name(c.author)}</span> {c.body}
                </span>
                <span className="flex items-center gap-2">
                  {c.mine || post.mine ? (
                    <ActionButton action={deleteComment} fields={{ commentId: c.id }} label="Hapus" variant="ghost" />
                  ) : (
                    <ReportDialog targetType="comment" targetId={c.id} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={addComment} className="flex gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <Input name="body" required maxLength={500} placeholder="Tulis komentar" aria-label="Komentar" />
          <ActionSubmitButton size="sm" variant="outline">
            Kirim
          </ActionSubmitButton>
        </ActionForm>
        {!post.mine && post.author ? (
          <div className="flex justify-end">
            <ActionButton
              action={blockAccount}
              fields={{ accountId: post.author.id }}
              label="Blokir"
              variant="ghost"
              confirmMessage={`Blokir ${post.author.fullName}? Pertemanan akan dihapus dan Anda tidak saling melihat konten.`}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
