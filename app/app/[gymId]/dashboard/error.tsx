"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto my-8 bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xs text-card-foreground space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Unable to load Dashboard</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {error.message || "Something went wrong while loading your gym overview."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
        <Link
          href="/select-workspace"
          className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-muted text-foreground border border-border text-xs sm:text-sm font-semibold hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Switch Workspace</span>
        </Link>
      </div>
    </div>
  );
}
