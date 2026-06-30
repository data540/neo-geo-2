export default function CompanyBioLoading() {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-3xl mx-auto animate-pulse">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-200 rounded" />
          <div className="h-3 w-64 bg-slate-100 rounded" />
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded-md" />
            </div>
          ))}
          <div className="h-9 w-36 bg-slate-200 rounded-md mt-2" />
        </div>
      </div>
    </div>
  );
}
