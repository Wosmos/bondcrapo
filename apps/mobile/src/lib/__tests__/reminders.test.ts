import { planDrawReminders, selectNewWins } from "../reminders";

const entry = (denominationCode: string, drawDate: string, status: "scheduled" | "published" = "scheduled") => ({
  denominationCode,
  drawNumber: null,
  drawDate,
  city: "Karachi",
  status,
});

describe("planDrawReminders", () => {
  const now = new Date(2026, 4, 10, 12, 0, 0); // 10 May 2026, noon local

  it("plans 09:00 reminders for owned denominations only, earliest first", () => {
    const plan = planDrawReminders(
      [entry("750", "2026-07-15"), entry("200", "2026-06-15"), entry("1500", "2026-05-15"), entry("750", "2026-05-11")],
      new Set(["750", "1500"]),
      now,
    );
    expect(plan.map((p) => p.id)).toEqual(["draw-750-2026-05-11", "draw-1500-2026-05-15", "draw-750-2026-07-15"]);
    expect(plan[0]!.fireAt).toEqual(new Date(2026, 4, 11, 9, 0, 0));
  });

  it("skips past draws, published draws, duplicates and caps the list", () => {
    const entries = [
      entry("750", "2026-05-10"), // 09:00 today already passed
      entry("750", "2026-05-12", "published"),
      entry("750", "2026-05-20"),
      entry("750", "2026-05-20"),
      ...Array.from({ length: 20 }, (_, i) => entry("100", `2026-08-${String(i + 1).padStart(2, "0")}`)),
    ];
    const plan = planDrawReminders(entries, new Set(["750", "100"]), now, 5);
    expect(plan).toHaveLength(5);
    expect(plan[0]!.id).toBe("draw-750-2026-05-20");
  });
});

describe("selectNewWins", () => {
  it("returns unseen matches that were not notified on this phone", () => {
    const matches = [
      { drawId: 1, bondNumber: "123456", seenAt: null },
      { drawId: 2, bondNumber: "123456", seenAt: "2026-05-01T00:00:00Z" },
      { drawId: 3, bondNumber: "000001", seenAt: null },
    ];
    expect(selectNewWins(matches, new Set(["3:000001"]))).toEqual([matches[0]]);
  });
});
