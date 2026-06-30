export default function PromptsLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-28 bg-slate-200 rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-slate-100 rounded-md" />
            <div className="h-9 w-32 bg-slate-100 rounded-md" />
          </div>
        </div>

        {/* KPI cards — 4 columnas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Tabla de prompts */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Cabecera tabla */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-8 w-24 bg-slate-100 rounded-md" />
          </div>
          {/* Filas */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50">
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-6 w-20 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
