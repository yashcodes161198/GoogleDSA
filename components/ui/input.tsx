import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
