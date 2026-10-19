import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-full border-2 px-6 text-base font-bold transition-[transform,background-color,color] duration-200 active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-[52px]";

const variants = {
  solid: "border-foreground bg-foreground text-background hover:bg-foreground/85",
  line: "border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
  volt: "border-primary bg-primary text-primary-foreground hover:brightness-105",
  ink: "border-[#0e0e0e] bg-[#0e0e0e] text-[#f2f2ee] hover:bg-[#26261f]",
} as const;

export function ctaClass(variant: keyof typeof variants = "solid", small = false) {
  return cn(base, variants[variant], small && "h-11 px-5 text-[15px] sm:h-11");
}

export function ArrowDot() {
  return (
    <span className="-mr-3 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
      <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
    </span>
  );
}
