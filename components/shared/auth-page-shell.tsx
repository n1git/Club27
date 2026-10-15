import Link from "next/link";
import { Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AuthPageShell({
  title,
  description,
  footer,
  wide,
  children,
}: {
  title: string;
  description: string;
  footer?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center flex-col gap-6 bg-background px-4 pb-10 pt-20">
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}>
          <Home className="size-4" aria-hidden />
          Beranda
        </Link>
        <ThemeToggle />
      </div>
      <Link href="/" aria-label="Beranda">
        <BrandLogo />
      </Link>
      <Card frame={false} className={wide ? "w-full max-w-3xl" : "w-full max-w-sm"}>
        <CardHeader>
          <h1 className="text-lg font-semibold leading-none tracking-tight">{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {children}
          {footer ? <p className="text-center text-sm text-muted-foreground">{footer}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
