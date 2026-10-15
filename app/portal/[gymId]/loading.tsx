export default function PortalLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Member Hero Card Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-slate-200 rounded-lg" />
            <div className="h-3 w-52 bg-slate-100 rounded-md" />
          </div>
        </div>
        <div className="h-7 w-28 bg-slate-100 rounded-full" />
      </div>

      {/* 1-Tap Attendance Check-In Button Skeleton */}
      <div className="h-14 w-full bg-slate-200 rounded-2xl" />

      {/* Digital Pass Skeleton */}
      <div className="bg-slate-900/10 rounded-2xl p-6 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-slate-200 rounded-md" />
          <div className="h-5 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded-md" />
            <div className="h-6 w-36 bg-slate-300 rounded-lg" />
            <div className="h-3 w-48 bg-slate-200 rounded-md" />
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Announcements / Quick Links Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-white rounded-2xl border border-slate-100 p-4" />
        <div className="h-24 bg-white rounded-2xl border border-slate-100 p-4" />
      </div>
    </div>
  );
}
