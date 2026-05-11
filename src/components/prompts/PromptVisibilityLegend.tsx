const LEGEND = [
  { color: "bg-green-500", label: "Top visibility", description: "Mencionada en 1ª posición" },
  { color: "bg-green-300", label: "Mencionada", description: "Mencionada (no en 1ª posición)" },
  {
    color: "bg-orange-400",
    label: "Solo competidores",
    description: "Competidores mencionados, tú no",
  },
  { color: "bg-slate-200", label: "Sin datos", description: "Ninguna marca mencionada" },
];

export function PromptVisibilityLegend() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${item.color}`} />
          <span className="text-xs text-slate-600">
            <span className="font-medium">{item.label}</span>
            <span className="text-slate-400 ml-1">— {item.description}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
