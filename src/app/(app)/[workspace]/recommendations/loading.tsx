export default function RecommendationsLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-56 bg-slate-100 rounded" />
          </div>
          <div className="h-9 w-40 bg-slate-100 rounded-md" />
        </div>

        {/* Cards de recomendaciones */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-64 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-4/5 bg-slate-100 rounded" />
                <div className="h-3 w-3/5 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="h-5 w-20 bg-slate-100 rounded-full" />
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
