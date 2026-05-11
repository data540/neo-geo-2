const FLAGS: Record<string, string> = {
  ES: "🇪🇸",
  MX: "🇲🇽",
  AR: "🇦🇷",
  CO: "🇨🇴",
  CL: "🇨🇱",
  PE: "🇵🇪",
  US: "🇺🇸",
  GB: "🇬🇧",
  DE: "🇩🇪",
  FR: "🇫🇷",
  IT: "🇮🇹",
  PT: "🇵🇹",
  BR: "🇧🇷",
};

interface Props {
  country: string;
}

export function CountryBadge({ country }: Props) {
  const flag = FLAGS[country] ?? "🌐";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <span>{flag}</span>
      <span>{country}</span>
    </span>
  );
}
