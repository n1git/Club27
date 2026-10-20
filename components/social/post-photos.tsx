import type { PostPhoto } from "@/lib/media/post-media";

export function PostPhotos({ photos }: { photos: PostPhoto[] }) {
  return (
    <div className={`grid gap-1.5 overflow-hidden rounded-xl ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {photos.map((photo, i) => (
        <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={photo.url}
            width={photo.width}
            height={photo.height}
            alt={`Foto ${i + 1} dari ${photos.length}`}
            loading="lazy"
            className={`h-full w-full bg-secondary object-cover ${photos.length > 1 ? "aspect-square" : "max-h-[480px]"}`}
          />
        </a>
      ))}
    </div>
  );
}
