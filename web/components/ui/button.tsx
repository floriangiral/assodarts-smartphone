import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: { default: "bg-navy text-white hover:bg-navy-deep", outline: "border border-border bg-surface text-ink hover:bg-muted" } },
  defaultVariants: { variant: "default" },
});
export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, className }))} {...props} />;
}
