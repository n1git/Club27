import Image from "next/image";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/ruzz-italic-lockup-white-transparent.svg" alt={APP_NAME} width={558} height={126} unoptimized priority className={cn("h-10 w-auto dark:hidden", className)} />
      <Image src="/brand/ruzz-italic-lockup-black-transparent.svg" alt="" aria-hidden="true" width={558} height={126} unoptimized priority className={cn("hidden h-10 w-auto dark:block", className)} />
    </>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/ruzz-italic-icon-yellow.svg" alt={APP_NAME} width={36} height={36} unoptimized className={cn("size-9 dark:hidden", className)} />
      <Image src="/brand/ruzz-italic-icon-black.svg" alt="" aria-hidden="true" width={36} height={36} unoptimized className={cn("hidden size-9 dark:block", className)} />
    </>
  );
}
