import Image from "next/image";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/logo-a-on-light.svg" alt={APP_NAME} width={354} height={180} unoptimized priority className={cn("h-16 w-auto dark:hidden", className)} />
      <Image src="/brand/logo-a-on-dark.svg" alt="" aria-hidden="true" width={354} height={180} unoptimized priority className={cn("hidden h-16 w-auto dark:block", className)} />
    </>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/icon-a2-charcoal.svg"
      alt={APP_NAME}
      width={36}
      height={36}
      unoptimized
      className={cn("size-9 rounded-lg ring-1 ring-border", className)}
    />
  );
}
