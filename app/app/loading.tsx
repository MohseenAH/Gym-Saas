export default function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Topbar Skeleton */}
      <header className="h-16 border-b border-border bg-card/60 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/20 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 rounded-md bg-primary/40" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-foreground/80">GymApra</span>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
              v2
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 bg-muted/60 rounded-lg animate-pulse hidden sm:block" />
          <div className="h-8 w-8 rounded-full bg-muted/80 animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-card p-4 sm:p-6 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 sm:w-64 bg-muted rounded-xl" />
            <div className="h-3.5 w-36 sm:w-48 bg-muted/60 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-muted rounded-xl" />
            <div className="h-9 w-28 bg-muted/80 rounded-xl" />
          </div>
        </div>

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3.5 sm:p-5 bg-card rounded-2xl border border-border shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-muted rounded-md" />
                <div className="h-7 w-7 bg-muted/60 rounded-lg" />
              </div>
              <div className="h-6 w-24 bg-muted rounded-lg" />
              <div className="h-2.5 w-16 bg-muted/50 rounded-md" />
            </div>
          ))}
        </div>

        {/* Content Card Skeleton */}
        <div className="bg-card rounded-2xl border border-border shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="h-4 w-36 bg-muted rounded-md" />
            <div className="h-8 w-32 bg-muted/60 rounded-xl" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted/60" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 bg-muted rounded-md" />
                    <div className="h-2.5 w-20 bg-muted/40 rounded-md" />
                  </div>
                </div>
                <div className="h-4 w-16 bg-muted/60 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
