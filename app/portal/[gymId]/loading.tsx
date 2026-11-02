export default function PortalLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Member Hero Card Skeleton */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xs p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-muted shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-36 sm:w-40 bg-muted rounded-lg" />
            <div className="h-3 w-44 sm:w-52 bg-muted/60 rounded-md" />
          </div>
        </div>
        <div className="h-7 w-28 bg-muted rounded-full" />
      </div>

      {/* 1-Tap Attendance Check-In Button Skeleton */}
      <div className="h-14 w-full bg-muted rounded-2xl" />

      {/* Digital Pass Skeleton */}
      <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted rounded-md" />
          <div className="h-5 w-16 bg-muted/60 rounded-full" />
        </div>
        <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded-md" />
            <div className="h-6 w-36 bg-muted rounded-lg" />
            <div className="h-3 w-48 bg-muted/60 rounded-md" />
          </div>
          <div className="h-10 w-full sm:w-32 bg-muted rounded-xl" />
        </div>
      </div>

      {/* Announcements / Quick Links Grid Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <div className="h-20 sm:h-24 bg-card rounded-2xl sm:rounded-3xl border border-border p-3 sm:p-4" />
        <div className="h-20 sm:h-24 bg-card rounded-2xl sm:rounded-3xl border border-border p-3 sm:p-4" />
      </div>
    </div>
  );
}
