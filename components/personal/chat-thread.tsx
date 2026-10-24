"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ImagePlus, SendHorizontal, X } from "lucide-react";
import { markThreadRead, sendMessage, unsendMessage } from "@/lib/actions/messages";
import type { ChatMessage, ChatThreadData } from "@/lib/data/messages";
import { formatJakartaDate, formatJakartaTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/social/avatar";
import { shrink } from "@/components/social/photo-picker";
import { ReportDialog } from "@/components/social/report-dialog";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const POLL_MS = 4000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Pending {
  clientId: string;
  body: string;
  file: File | null;
  previewUrl: string | null;
  createdAt: string;
  status: "sending" | "failed";
}

type Row = { key: string; day: string; message: ChatMessage; pending?: Pending };

function dayKey(iso: string) {
  return formatJakartaDate(iso, { day: "numeric", month: "long", year: "numeric" });
}

function dayLabel(iso: string, today: string, yesterday: string) {
  const key = dayKey(iso);
  return key === today ? "Hari ini" : key === yesterday ? "Kemarin" : key;
}

export function ChatThread({ initial }: { initial: ChatThreadData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [outbox, setOutbox] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [now] = useState(() => Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const marked = useRef("");
  const { peer } = data;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm?u=${encodeURIComponent(initial.peer.username)}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as ChatThreadData);
    } catch {
      return;
    }
  }, [initial.peer.username]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  useEffect(() => {
    const unread = data.messages.filter((m) => !m.mine && !m.readAt && !m.deleted);
    if (!data.threadId || !unread.length) return;
    const key = unread[unread.length - 1].id;
    if (marked.current === key) return;
    marked.current = key;
    void markThreadRead(data.threadId).then(() => router.refresh());
  }, [data, router]);

  const confirmed = new Set(data.messages.map((m) => m.clientId).filter(Boolean));
  const waiting = outbox.filter((o) => !confirmed.has(o.clientId));
  const lastCount = data.messages.length + waiting.length;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastCount]);

  async function deliver(item: Pending) {
    setOutbox((list) => list.map((i) => (i.clientId === item.clientId ? { ...i, status: "sending" } : i)));
    const form = new FormData();
    form.set("toId", peer.id);
    form.set("clientId", item.clientId);
    form.set("body", item.body);
    if (item.file) form.set("photo", item.file);
    let result: { ok?: boolean; error?: string };
    try {
      result = await sendMessage({}, form);
    } catch {
      result = { ok: false, error: "Terjadi kesalahan. Coba lagi." };
    }
    if (result.ok) {
      await refresh();
      setOutbox((list) => list.filter((i) => i.clientId !== item.clientId));
    } else {
      setOutbox((list) => list.map((i) => (i.clientId === item.clientId ? { ...i, status: "failed" } : i)));
      toast.error(result.error ?? "Pesan gagal terkirim");
    }
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if ((!body && !photo) || busy) return;
    const item: Pending = { clientId: crypto.randomUUID(), body, file: photo?.file ?? null, previewUrl: photo?.url ?? null, createdAt: new Date().toISOString(), status: "sending" };
    setOutbox((list) => [...list, item]);
    setDraft("");
    setPhoto(null);
    void deliver(item);
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return void toast.error("Foto harus berformat JPEG, PNG, atau WebP");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Ukuran foto maksimal 5 MB");
    setBusy(true);
    try {
      const small = await shrink(file);
      setPhoto({ file: small, url: URL.createObjectURL(small) });
    } catch {
      toast.error("Foto tidak bisa dibaca. Coba foto lain.");
    } finally {
      setBusy(false);
    }
  }

  async function unsend(message: ChatMessage) {
    setMenu(null);
    const result = await unsendMessage(message.id);
    if (result.ok) {
      toast.success("Pesan ditarik");
      await refresh();
    } else {
      toast.error(result.error ?? "Gagal menarik pesan");
    }
  }

  const today = dayKey(new Date(now).toISOString());
  const yesterday = dayKey(new Date(now - 24 * 60 * 60 * 1000).toISOString());
  const rows: Row[] = [
    ...data.messages.map((m) => ({ key: m.id, day: dayKey(m.createdAt), message: m })),
    ...waiting.map((p) => ({
      key: p.clientId,
      day: dayKey(p.createdAt),
      pending: p,
      message: { id: p.clientId, clientId: p.clientId, mine: true, body: p.body || null, photoUrl: p.previewUrl, photoWidth: null, photoHeight: null, createdAt: p.createdAt, readAt: null, deleted: false },
    })),
  ];
  const lastMine = [...data.messages].reverse().find((m) => m.mine && !m.deleted);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background sm:static sm:z-auto sm:h-[calc(100dvh-9rem)] sm:max-w-xl sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))]">
        <Link href="/messages" aria-label="Kembali ke pesan" className="flex size-11 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeft size={24} aria-hidden="true" />
        </Link>
        <Link href={`/${peer.username}`} className="flex min-w-0 items-center gap-3 rounded-lg py-1 pr-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar name={peer.fullName} src={peer.avatarUrl} size={36} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{peer.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">@{peer.username}</span>
          </span>
        </Link>
      </header>

      <div ref={scroller} role="log" aria-label={`Percakapan dengan ${peer.fullName}`} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
        {rows.length === 0 ? <p className="m-auto text-center text-sm text-muted-foreground">Belum ada pesan. Sapa {peer.fullName.split(" ")[0]}.</p> : null}
        {rows.map((row, i) => {
          const m = row.message;
          const prev = rows[i - 1];
          const newDay = !prev || prev.day !== row.day;
          const sameSender = prev && !newDay && prev.message.mine === m.mine;
          return (
            <div key={row.key} className="flex flex-col">
              {newDay ? <p className="my-3 text-center text-xs text-muted-foreground">{dayLabel(m.createdAt, today, yesterday)}</p> : null}
              <div className={cn("flex", m.mine ? "justify-end" : "justify-start", sameSender ? "mt-0.5" : "mt-2")}>
                <button
                  type="button"
                  disabled={Boolean(row.pending) || m.deleted}
                  onClick={() => setMenu(m)}
                  aria-label={`${m.mine ? "Pesan Anda" : `Pesan dari ${peer.fullName}`}, ${formatJakartaTime(m.createdAt)}. Buka opsi`}
                  className={cn(
                    "max-w-[78%] overflow-hidden whitespace-pre-wrap break-words rounded-2xl text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    m.deleted
                      ? "border border-dashed border-border px-3 py-2 italic text-muted-foreground"
                      : m.mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    row.pending?.status === "sending" && "opacity-60",
                    !m.deleted && (m.photoUrl && !m.body ? "p-0" : !m.photoUrl ? "px-3 py-2" : "p-0"),
                  )}
                >
                  {m.deleted ? (
                    "Pesan ditarik"
                  ) : (
                    <>
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt="Foto dalam pesan"
                          width={m.photoWidth ?? undefined}
                          height={m.photoHeight ?? undefined}
                          className="block max-h-80 w-full rounded-2xl object-cover"
                        />
                      ) : null}
                      {m.body ? <span className={cn("block", m.photoUrl && "px-3 py-2")}>{m.body}</span> : null}
                    </>
                  )}
                </button>
              </div>
              {row.pending?.status === "failed" ? (
                <p className="mt-1 flex justify-end gap-3 text-xs text-destructive">
                  Gagal terkirim
                  <button type="button" onClick={() => void deliver(row.pending as Pending)} className="font-semibold underline underline-offset-2">
                    Coba lagi
                  </button>
                  <button type="button" onClick={() => setOutbox((list) => list.filter((x) => x.clientId !== row.key))} className="text-muted-foreground underline underline-offset-2">
                    Hapus
                  </button>
                </p>
              ) : null}
              {m.id === lastMine?.id && m.readAt ? <p className="mt-0.5 text-right text-xs text-muted-foreground">Dilihat</p> : null}
            </div>
          );
        })}
      </div>

      {data.canSend ? (
        <form onSubmit={submit} className="shrink-0 border-t border-border bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {photo ? (
            <div className="mb-2 flex items-center gap-2">
              <img src={photo.url} alt="Pratinjau foto" className="size-14 rounded-lg object-cover" />
              <button type="button" aria-label="Hapus foto" onClick={() => setPhoto(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label="Kirim foto"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <ImagePlus size={22} aria-hidden="true" />
            </button>
            <input ref={fileInput} type="file" accept={TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) submit(e);
              }}
              rows={1}
              maxLength={2000}
              aria-label="Tulis pesan"
              placeholder="Tulis pesan…"
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-base [field-sizing:content] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
            <button
              type="submit"
              aria-label="Kirim"
              disabled={busy || (!draft.trim() && !photo)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ui-transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <SendHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <p className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground">
          Percakapan ini hanya bisa dibaca karena kalian tidak lagi berteman.
        </p>
      )}

      <BottomSheet open={menu !== null} onClose={() => setMenu(null)} title="Pesan">
        {menu ? (
          <ul className="divide-y divide-border">
            {menu.mine ? (
              <li>
                <button type="button" onClick={() => void unsend(menu)} className="flex min-h-12 w-full items-center px-4 text-left text-sm font-medium text-destructive hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  Tarik pesan
                </button>
              </li>
            ) : (
              <li>
                <ReportDialog
                  targetType="message"
                  targetId={menu.id}
                  trigger={<span className="flex min-h-12 w-full cursor-pointer items-center px-4 text-sm font-medium hover:bg-accent">Laporkan pesan</span>}
                />
              </li>
            )}
            <li className="px-4 py-3 text-xs text-muted-foreground">{formatJakartaDate(menu.createdAt, { day: "numeric", month: "long", year: "numeric" })}, {formatJakartaTime(menu.createdAt)}</li>
          </ul>
        ) : null}
      </BottomSheet>
    </div>
  );
}
