export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading dashboard…</span>
      <div className="h-16 w-2/3 max-w-md animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
