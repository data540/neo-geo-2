export default function CompetitorsLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-36 bg-slate-200 rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-40 bg-slate-100 rounded-md" />
            <div className="h-9 w-32 bg-slate-100 rounded-md" />
          </div>
        </div>

        {/* KPI cards — 3 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Panel de tendencias */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
          <div className="h-48 w-full bg-slate-100 rounded" />
        </div>

        {/* Tabla de competidores */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-8 w-28 bg-slate-100 rounded-md" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50">
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-6 w-16 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
