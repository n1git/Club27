import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ui-transition active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border border-[#111214]/15 bg-primary text-primary-foreground shadow-sm hover:-translate-y-px hover:brightness-95 dark:border-transparent dark:hover:brightness-90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 in-[.app-ui]:h-11 in-[.app-ui]:rounded-lg in-[.app-ui]:px-3 in-[.app-ui]:py-0 in-[.app-ui]:text-sm in-[.app-ui]:sm:h-8 in-[.app-ui]:sm:text-xs",
        sm: "h-8 rounded-md px-3 text-xs in-[.app-ui]:h-11 in-[.app-ui]:rounded-lg in-[.app-ui]:sm:h-8",
        lg: "h-10 rounded-md px-8 in-[.app-ui]:h-11 in-[.app-ui]:rounded-lg in-[.app-ui]:px-5 in-[.app-ui]:sm:h-9",
        icon: "h-9 w-9 in-[.app-ui]:size-11 in-[.app-ui]:rounded-lg in-[.app-ui]:sm:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
