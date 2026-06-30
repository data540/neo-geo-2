export default function TeamLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-20 bg-slate-200 rounded" />
          <div className="h-9 w-32 bg-slate-100 rounded-md" />
        </div>

        {/* Tabla de miembros */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-4 w-28 bg-slate-200 rounded" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
              <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-40 bg-slate-100 rounded" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-slate-100 rounded-full" />
              <div className="h-8 w-20 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
