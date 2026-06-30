export default function SettingsLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-2xl mx-auto animate-pulse">
        {/* Header */}
        <div className="h-7 w-28 bg-slate-200 rounded" />

        {/* Secciones de settings */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-px w-full bg-slate-100" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded-md" />
              </div>
            ))}
            <div className="h-9 w-28 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
