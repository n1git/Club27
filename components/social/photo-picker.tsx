"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_FILES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1600;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function PhotoPicker({ pending }: { pending: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function setFiles(files: File[]) {
    const transfer = new DataTransfer();
    files.forEach((f) => transfer.items.add(f));
    if (input.current) input.current.files = transfer.files;
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length > MAX_FILES) {
      toast.error("Maksimal 4 foto per postingan");
      setFiles([]);
      return;
    }
    if (picked.some((f) => !TYPES.includes(f.type))) {
      toast.error("Foto harus berformat JPEG, PNG, atau WebP");
      setFiles([]);
      return;
    }
    if (picked.some((f) => f.size > MAX_BYTES)) {
      toast.error("Ukuran foto maksimal 5 MB");
      setFiles([]);
      return;
    }
    setBusy(true);
    try {
      setFiles(await Promise.all(picked.map(shrink)));
    } catch {
      toast.error("Foto tidak bisa dibaca. Coba foto lain.");
      setFiles([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {previews.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {previews.map((url, i) => (
            <img key={url} src={url} alt={`Pratinjau foto ${i + 1}`} className="size-16 rounded-lg object-cover" />
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setFiles([])} aria-label="Hapus semua foto">
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium focus-within:ring-2 focus-within:ring-ring">
          <ImagePlus aria-hidden className="size-4" />
          {busy ? "Memproses foto..." : "Tambah foto"}
          <input ref={input} type="file" name="photos" accept={TYPES.join(",")} multiple className="sr-only" onChange={onPick} disabled={busy} />
        </label>
        <span className="text-xs text-muted-foreground">Maks 4 foto, 5 MB per foto. Lokasi dan data kamera dihapus.</span>
      </div>
      <Button type="submit" className="w-fit" disabled={busy || pending}>
        {pending ? "Menambahkan…" : "Posting"}
      </Button>
    </>
  );
}
