"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeAvatar, updateAvatar } from "@/lib/actions/avatar";
import { Avatar } from "@/components/social/avatar";
import { shrink } from "@/components/social/photo-picker";
import { Button } from "@/components/ui/button";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarEditor({ name, url }: { name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(task: () => Promise<{ ok?: boolean; error?: string; message?: string }>) {
    start(async () => {
      const id = toast.loading("Menyimpan…");
      const result = await task();
      if (result.ok) toast.success(result.message ?? "Tersimpan", { id });
      else toast.error(result.error ?? "Gagal menyimpan", { id });
      router.refresh();
    });
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return void toast.error("Foto harus berformat JPEG, PNG, atau WebP");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Ukuran foto maksimal 5 MB");
    let small: File;
    try {
      small = await shrink(file, 1024);
    } catch {
      return void toast.error("Foto tidak bisa dibaca. Coba foto lain.");
    }
    const form = new FormData();
    form.set("avatar", small);
    run(() => updateAvatar({}, form));
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={url} size={80} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
          {url ? "Ganti foto" : "Unggah foto"}
        </Button>
        {url ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeAvatar())}>
            Hapus
          </Button>
        ) : null}
        <input ref={input} type="file" accept={TYPES.join(",")} className="sr-only" aria-label="Pilih foto profil" onChange={onPick} />
      </div>
    </div>
  );
}
