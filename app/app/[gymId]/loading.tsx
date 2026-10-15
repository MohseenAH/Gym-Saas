export default function AppLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-xl" />
          <div className="h-3.5 w-72 bg-slate-100 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
          <div className="h-9 w-36 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-100 rounded-md" />
              <div className="h-7 w-7 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-6 w-24 bg-slate-200 rounded-lg" />
            <div className="h-2.5 w-16 bg-slate-100 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="h-4 w-32 bg-slate-200 rounded-md" />
          <div className="h-8 w-44 bg-slate-100 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-slate-200 rounded-full" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-200 rounded-md" />
                  <div className="h-2.5 w-20 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="h-4 w-16 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
