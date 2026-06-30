export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-64 bg-slate-100 rounded-full" />
            <div className="h-8 w-28 bg-slate-100 rounded-md" />
            <div className="h-8 w-24 bg-slate-100 rounded-full" />
            <div className="h-8 w-28 bg-slate-100 rounded-md" />
          </div>
        </div>

        {/* KPI cards — 4 columnas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="w-8 h-8 rounded-full bg-slate-100" />
              </div>
              <div className="h-8 w-24 bg-slate-200 rounded" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded mt-2" />
            </div>
          ))}
        </div>

        {/* Segunda fila KPI — 2 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="w-8 h-8 rounded-full bg-slate-100" />
              </div>
              <div className="h-8 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Chart panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="h-4 w-36 bg-slate-200 rounded mb-4" />
              <div className="h-48 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
