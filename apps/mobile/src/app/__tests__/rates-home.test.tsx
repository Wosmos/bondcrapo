import { screen } from "@testing-library/react-native";
import HomeScreen from "../(tabs)/index";
import RatesScreen from "../(tabs)/rates";
import UpdateScreen from "../update";
import { appManifest, localRatesPk } from "@/test-utils/fixtures";
import { mockApi, ok, renderScreen } from "@/test-utils/render";
import { UpdateBootstrap } from "@/test-utils/update-bootstrap";

describe("Rates screen", () => {
  it("labels reported and estimated prices and shows per tola and per 10 g", async () => {
    mockApi(({ path }) =>
      path === "/markets/local-rates"
        ? ok(localRatesPk, { attribution: [{ name: "APSGJA", text: "Gold rates reported by APSGJA via APP" }] })
        : undefined,
    );
    await renderScreen(<RatesScreen />);
    expect(await screen.findByText("437,836")).toBeTruthy();
    expect(screen.getByText("Reported")).toBeTruthy();
    expect(screen.getByText("Estimated")).toBeTruthy();
    expect(screen.getByText("Gold rates reported by APSGJA via APP")).toBeTruthy();
  });
});

describe("Home screen", () => {
  it("shows a calm 'coming soon' state while endpoints are not live", async () => {
    mockApi(() => undefined);
    await renderScreen(<HomeScreen />);
    expect((await screen.findAllByText("Coming soon")).length).toBeGreaterThan(0);
    expect(screen.getByText("Did your prize bond win?")).toBeTruthy();
  });

  it("offers an optional update when a newer release exists", async () => {
    mockApi(({ path }) => (path === "/app/latest" ? ok(appManifest) : undefined));
    await renderScreen(
      <>
        <UpdateBootstrap />
        <HomeScreen />
      </>,
    );
    expect(await screen.findByText("Version 1.3.0 is available")).toBeTruthy();
  });

  it("renders in Urdu", async () => {
    mockApi(() => undefined);
    await renderScreen(<HomeScreen />, { locale: "ur" });
    expect(await screen.findByText("کیا آپ کا پرائز بانڈ نکلا؟")).toBeTruthy();
  });
});

describe("Update screen", () => {
  it("blocks the app when the installed build is no longer supported", async () => {
    mockApi(({ path }) => (path === "/app/latest" ? ok({ ...appManifest, minSupportedVersionCode: 10300 }) : undefined));
    await renderScreen(
      <>
        <UpdateBootstrap />
        <UpdateScreen />
      </>,
    );
    expect(await screen.findByText("Please update BondCheck")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
    expect(screen.getByText("d".repeat(64))).toBeTruthy();
  });
});
