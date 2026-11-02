export default function AppLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded-xl" />
          <div className="h-3.5 w-72 bg-muted/60 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
          <div className="h-10 w-full sm:w-28 bg-muted rounded-xl" />
          <div className="h-10 w-full sm:w-36 bg-muted rounded-xl" />
        </div>
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xs space-y-2 sm:space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 sm:w-20 bg-muted rounded-md" />
              <div className="h-6 w-6 sm:h-7 sm:w-7 bg-muted rounded-lg" />
            </div>
            <div className="h-5 sm:h-6 w-20 sm:w-24 bg-muted rounded-lg" />
            <div className="h-2.5 w-12 sm:w-16 bg-muted/60 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xs p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="h-4 w-32 bg-muted rounded-md" />
          <div className="h-8 w-44 bg-muted/60 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-muted rounded-full" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 sm:w-32 bg-muted rounded-md" />
                  <div className="h-2.5 w-16 sm:w-20 bg-muted/60 rounded-md" />
                </div>
              </div>
              <div className="h-4 w-14 sm:w-16 bg-muted rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
