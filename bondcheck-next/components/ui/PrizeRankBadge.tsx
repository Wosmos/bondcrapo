export function PrizeRankBadge({ position }: { position: string }) {
  const color = position.includes("1st")
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : position.includes("2nd")
      ? "text-blue-600 bg-blue-50 border-blue-200"
      : "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <span
      className={`px-2 py-1 text-xs font-bold uppercase border rounded-sm ${color}`}
    >
      {position}
    </span>
  );
}
