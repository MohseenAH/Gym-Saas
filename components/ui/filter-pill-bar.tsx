import type { ReactNode } from "react";

export interface FilterPillItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface FilterPillBarProps<T extends string> {
  items: readonly FilterPillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Shared mobile filter-pill bar with even proportional spacing across compact widths.
 */
export function FilterPillBar<T extends string>({
  items,
  value,
  onChange,
  ariaLabel = "Filter criteria",
  className = "",
}: FilterPillBarProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex items-center gap-1.5 w-full ${className}`}
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`flex-auto h-8 px-2.5 rounded-full text-[11px] font-bold border whitespace-nowrap inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
