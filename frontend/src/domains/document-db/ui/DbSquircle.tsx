// Brand squircle for a Document DB: deterministic gradient + the name's initial.
// Gives each domain a visual identity instead of a generic file icon.
const PALETTE = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
];

function accent(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function DbSquircle({
  id,
  name,
  className = "w-10 h-10 rounded-xl text-sm",
}: {
  id: string;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`grid place-items-center shrink-0 bg-gradient-to-br ${accent(id)} text-white font-semibold leading-none select-none ${className}`}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
