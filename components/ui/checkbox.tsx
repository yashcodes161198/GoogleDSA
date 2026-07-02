import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex h-6 w-6 shrink-0 items-center justify-center",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none disabled:cursor-not-allowed"
      />
      <span
        className={cn(
          "pointer-events-none flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-emerald-600 bg-emerald-600"
            : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-zinc-950"
        )}
      >
        <Check
          className={cn(
            "h-4 w-4 text-white transition-opacity",
            checked ? "opacity-100" : "opacity-0"
          )}
          strokeWidth={3}
        />
      </span>
    </label>
  );
}
