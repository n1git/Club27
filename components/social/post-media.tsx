"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostPhoto } from "@/lib/media/post-media";

const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;

export function PostMedia({ photos }: { photos: PostPhoto[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const first = photos[0];
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.width / first.height));
  const many = photos.length > 1;

  function go(to: number) {
    const el = track.current;
    if (el) el.scrollTo({ left: el.clientWidth * to, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return (
    <div className="relative bg-secondary">
      <div
        ref={track}
        role="region"
        aria-label={many ? `Foto postingan, ${index + 1} dari ${photos.length}` : "Foto postingan"}
        tabIndex={many ? 0 : undefined}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        style={{ aspectRatio: ratio }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <div key={photo.url} className="size-full shrink-0 snap-center">
            <img
              src={photo.url}
              width={photo.width}
              height={photo.height}
              alt={`Foto ${i + 1} dari ${photos.length}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="size-full object-cover"
            />
          </div>
        ))}
      </div>
      {many ? (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
            {index + 1}/{photos.length}
          </span>
          {index > 0 ? (
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:fine)]:flex"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          {index < photos.length - 1 ? (
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:fine)]:flex"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="flex gap-1.5 rounded-full bg-black/45 px-2 py-1.5">
              {photos.map((photo, i) => (
                <span key={photo.url} className={i === index ? "size-1.5 rounded-full bg-white" : "size-1.5 rounded-full bg-white/50"} />
              ))}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
