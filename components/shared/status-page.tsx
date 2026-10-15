import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { buttonVariants } from "@/components/ui/button";

export function StatusPage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <Link href="/" aria-label="Beranda">
        <BrandLogo />
      </Link>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-pretty text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {action}
        <Link href="/" className={buttonVariants({ variant: action ? "outline" : "default", size: "lg", className: "h-11 px-6" })}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
