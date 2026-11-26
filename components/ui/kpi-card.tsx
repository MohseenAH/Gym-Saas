import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type KpiCardVariant = "green" | "blue" | "purple" | "amber" | "red" | "slate";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  variant: KpiCardVariant;
  subtext?: ReactNode;
  trend?: ReactNode;
  href?: string;
  title?: string;
  compact?: boolean;
  horizontal?: boolean;
  horizontalMobile?: boolean;
  hideChevron?: boolean;
  onClick?: () => void;
  active?: boolean;
}

const VARIANT_STYLES: Record<
  KpiCardVariant,
  {
    card: string;
    icon: string;
    iconStrong: string;
    chevron: string;
    focus: string;
    active: string;
  }
> = {
  green: {
    card: "bg-card bg-gradient-to-br from-emerald-50 via-emerald-50/85 to-emerald-100/60 border-emerald-200/90 hover:border-emerald-300 dark:from-emerald-500/[0.17] dark:via-emerald-500/[0.11] dark:to-emerald-500/[0.07] dark:border-emerald-500/30 dark:hover:border-emerald-400/50",
    icon: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/25 dark:border-emerald-400/30",
    iconStrong: "bg-emerald-500/18 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-400/35",
    chevron: "text-emerald-700/65 dark:text-emerald-400/75 group-hover:text-emerald-800 dark:group-hover:text-emerald-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-emerald-500/35 border-emerald-400/80 dark:border-emerald-400/65",
  },
  blue: {
    card: "bg-card bg-gradient-to-br from-blue-50 via-blue-50/85 to-blue-100/60 border-blue-200/90 hover:border-blue-300 dark:from-blue-500/[0.17] dark:via-blue-500/[0.11] dark:to-blue-500/[0.07] dark:border-blue-500/30 dark:hover:border-blue-400/50",
    icon: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/25 dark:border-blue-400/30",
    iconStrong: "bg-blue-500/18 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300 border-blue-500/30 dark:border-blue-400/35",
    chevron: "text-blue-700/65 dark:text-blue-400/75 group-hover:text-blue-800 dark:group-hover:text-blue-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-blue-500/35 border-blue-400/80 dark:border-blue-400/65",
  },
  purple: {
    card: "bg-card bg-gradient-to-br from-purple-50 via-purple-50/85 to-purple-100/60 border-purple-200/90 hover:border-purple-300 dark:from-purple-500/[0.17] dark:via-purple-500/[0.11] dark:to-purple-500/[0.07] dark:border-purple-500/30 dark:hover:border-purple-400/50",
    icon: "bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/25 dark:border-purple-400/30",
    iconStrong: "bg-purple-500/18 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 border-purple-500/30 dark:border-purple-400/35",
    chevron: "text-purple-700/65 dark:text-purple-400/75 group-hover:text-purple-800 dark:group-hover:text-purple-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-purple-500/35 border-purple-400/80 dark:border-purple-400/65",
  },
  amber: {
    card: "bg-card bg-gradient-to-br from-amber-50 via-amber-50/85 to-amber-100/60 border-amber-200/90 hover:border-amber-300 dark:from-amber-500/[0.17] dark:via-amber-500/[0.11] dark:to-amber-500/[0.07] dark:border-amber-500/30 dark:hover:border-amber-400/50",
    icon: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/25 dark:border-amber-400/30",
    iconStrong: "bg-amber-500/18 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30 dark:border-amber-400/35",
    chevron: "text-amber-700/65 dark:text-amber-400/75 group-hover:text-amber-800 dark:group-hover:text-amber-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-amber-500/35 border-amber-400/80 dark:border-amber-400/65",
  },
  red: {
    card: "bg-card bg-gradient-to-br from-rose-50 via-rose-50/85 to-rose-100/60 border-rose-200/90 hover:border-rose-300 dark:from-rose-500/[0.17] dark:via-rose-500/[0.11] dark:to-rose-500/[0.07] dark:border-rose-500/30 dark:hover:border-rose-400/50",
    icon: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/25 dark:border-rose-400/30",
    iconStrong: "bg-rose-500/18 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border-rose-500/30 dark:border-rose-400/35",
    chevron: "text-rose-700/65 dark:text-rose-400/75 group-hover:text-rose-800 dark:group-hover:text-rose-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-rose-500/35 border-rose-400/80 dark:border-rose-400/65",
  },
  slate: {
    card: "bg-card bg-gradient-to-br from-slate-50 via-slate-50/85 to-slate-100/60 border-slate-200/90 hover:border-slate-300 dark:from-slate-500/[0.17] dark:via-slate-500/[0.11] dark:to-slate-500/[0.07] dark:border-slate-500/30 dark:hover:border-slate-400/50",
    icon: "bg-slate-500/15 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border-slate-500/25 dark:border-slate-400/30",
    iconStrong: "bg-slate-500/18 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300 border-slate-500/30 dark:border-slate-400/35",
    chevron: "text-slate-700/65 dark:text-slate-400/75 group-hover:text-slate-800 dark:group-hover:text-slate-300",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active: "ring-2 ring-slate-500/35 border-slate-400/80 dark:border-slate-400/65",
  },
};

export function KpiCard({
  label,
  value,
  icon,
  variant,
  subtext,
  trend,
  href,
  title,
  compact = false,
  horizontal = false,
  horizontalMobile = false,
  hideChevron = false,
  onClick,
  active = false,
}: KpiCardProps) {
  const styles = VARIANT_STYLES[variant];
  const isInteractive = Boolean(href || onClick);
  const showChevron = isInteractive && !hideChevron;

  const content = horizontal ? (
    <>
      <div
        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 ${styles.iconStrong}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground leading-tight truncate">
            {label}
          </span>
          {showChevron && (
            <ChevronRight
              className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${styles.chevron}`}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-lg sm:text-2xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
            {value}
          </span>
          {trend}
        </div>

        {subtext && (
          <div className="mt-1 text-[11px] text-muted-foreground leading-tight">
            {subtext}
          </div>
        )}
      </div>
    </>
  ) : horizontalMobile ? (
    <>
      <div
        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full sm:rounded-lg border flex items-center justify-center shrink-0 ${styles.icon}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">
            {label}
          </span>
          {showChevron && (
            <ChevronRight
              className={`hidden sm:block w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${styles.chevron}`}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-lg sm:text-xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
            {value}
          </span>
          {trend}
        </div>

        {subtext && (
          <div className="mt-1 text-[11px] text-muted-foreground leading-tight">
            {subtext}
          </div>
        )}
      </div>

      {showChevron && (
        <ChevronRight
          className={`w-4 h-4 shrink-0 sm:hidden transition-transform group-hover:translate-x-0.5 ${styles.chevron}`}
          aria-hidden="true"
        />
      )}
    </>
  ) : (
    <>
      <div className="flex items-center justify-between gap-2 sm:contents">
        <div className="flex items-center gap-2 sm:contents min-w-0">
          <div
            className={`${
              compact
                ? "w-7 h-7 sm:w-8 sm:h-8 rounded-lg"
                : "w-8 h-8 sm:w-10 sm:h-10 rounded-xl"
            } border flex items-center justify-center shrink-0 ${styles.icon}`}
          >
            {icon}
          </div>
          <span className="text-[12px] font-medium text-muted-foreground leading-tight truncate sm:hidden">
            {label}
          </span>
        </div>
        {showChevron && (
          <ChevronRight
            className={`w-4 h-4 shrink-0 sm:hidden transition-transform group-hover:translate-x-0.5 ${styles.chevron}`}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="hidden sm:flex items-center justify-between gap-1.5">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {label}
          </span>
          {showChevron && (
            <ChevronRight
              className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${styles.chevron}`}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="sm:mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span
            className={`${
              compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            } font-extrabold text-foreground tabular-nums tracking-tight leading-none`}
          >
            {value}
          </span>
          {trend}
        </div>

        {subtext && (
          <div className="mt-1 text-[12px] sm:text-[11px] text-muted-foreground leading-tight">
            {subtext}
          </div>
        )}
      </div>
    </>
  );

  const baseClassName = `group border rounded-2xl ${
    horizontal ? "p-2.5 sm:p-3.5 h-full" : compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4"
  } shadow-xs transition-all flex ${
    horizontal
      ? "flex-row items-center gap-2.5 sm:gap-3"
      : horizontalMobile
      ? "flex-row items-center sm:items-start gap-2.5"
      : "flex-col sm:flex-row sm:items-start gap-2 sm:gap-2.5"
  } min-w-0 text-left ${
    styles.card
  } ${active ? styles.active : ""}`;

  if (href) {
    return (
      <Link href={href} title={title} className={`${baseClassName} ${styles.focus}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={active}
        className={`w-full cursor-pointer ${baseClassName} ${styles.focus}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div title={title} className={baseClassName}>
      {content}
    </div>
  );
}
