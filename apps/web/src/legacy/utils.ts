export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  if (!dateStr.includes("-")) return dateStr;

  try {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;

    const day = parseInt(parts[0]);
    const monthStr = parts[1].trim();
    const year = parts[2].trim();

    let month: number;
    if (!isNaN(Number(monthStr))) {
      month = parseInt(monthStr) - 1;
    } else {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      month = months[monthStr.toLowerCase().substring(0, 3)];
    }

    if (isNaN(day) || month === undefined || isNaN(month)) return dateStr;

    const date = new Date(parseInt(year), month, day);
    if (isNaN(date.getTime())) return dateStr;

    const suffix = (d: number) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };

    const monthName = date.toLocaleString("en-US", { month: "short" });
    return `${day}${suffix(day)} ${monthName}, ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatCompact(num: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}
