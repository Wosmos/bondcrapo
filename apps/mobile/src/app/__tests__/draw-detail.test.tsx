import { fireEvent, screen } from "@testing-library/react-native";
import DrawDetail from "../draws/[code]/[number]";
import { drawDetail } from "@/test-utils/fixtures";
import { setParams } from "@/test-utils/router-mock";
import { mockApi, ok, renderScreen } from "@/test-utils/render";

describe("Draw detail", () => {
  beforeEach(() => setParams({ code: "750", number: "104" }));

  it("shows the prize table, top numbers, status and sources", async () => {
    mockApi(({ path }) => (path === "/bonds/draws/750/104" ? ok(drawDetail) : undefined));
    await renderScreen(<DrawDetail />);

    expect(await screen.findByText("482913")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("1,500,000")).toBeTruthy();
    expect(screen.getByText("3 winners")).toBeTruthy();
    expect(screen.getByText("National Savings (official file)")).toBeTruthy();
  });

  it("pages through the third prize list on request", async () => {
    mockApi(({ path, search }) => {
      if (path === "/bonds/draws/750/104") return ok(drawDetail);
      if (path === "/bonds/draws/750/104/results" && search.get("tier") === "3")
        return ok([{ bondNumber: "000123", tier: 3 }], { page: 1, pageSize: 200, total: 1696 });
    });
    await renderScreen(<DrawDetail />);
    await fireEvent.press(await screen.findByRole("button", { name: "Show third prize numbers" }));
    expect(await screen.findByText("000123")).toBeTruthy();
    expect(screen.getByText("Showing 1 of 1,696")).toBeTruthy();
  });

  it("looks up a single number in this draw", async () => {
    mockApi(({ path, method }) => {
      if (path === "/bonds/draws/750/104") return ok(drawDetail);
      if (method === "POST" && path === "/bonds/check")
        return ok({ checked: 1, wins: [{ bondNumber: "105377", denominationCode: "750", drawId: 501, drawNumber: 104, drawDate: "2026-04-15", tier: 2, amountPkr: 500000 }] });
    });
    await renderScreen(<DrawDetail />);
    await fireEvent.changeText(await screen.findByLabelText("Bond number"), "105377");
    await fireEvent.press(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("This number won the Second prize: Rs 500,000.")).toBeTruthy();
  });
});
