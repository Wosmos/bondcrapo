import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { defaultSettings, loadSettings, saveSettings } from "../settings";

const KEY = "bondcheck.settings.v1";

describe("settings theme", () => {
  afterEach(() => jest.restoreAllMocks());

  it("starts from the phone's light or dark setting on first run", () => {
    expect(defaultSettings("en", "dark").theme).toBe("dark");
    expect(defaultSettings("en", "light").theme).toBe("light");
    expect(defaultSettings("en", null).theme).toBe("light");
  });

  it("keeps the chosen mode regardless of the phone setting", async () => {
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");
    await saveSettings({ ...defaultSettings("ur"), theme: "light" });
    expect((await loadSettings()).theme).toBe("light");
  });

  it("turns an old 'system' choice into the phone's current mode without losing other settings", async () => {
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");
    await AsyncStorage.setItem(KEY, JSON.stringify({ locale: "ur", theme: "system", drawReminders: true, winAlerts: true }));
    expect(await loadSettings()).toEqual({ locale: "ur", theme: "dark", drawReminders: true, winAlerts: true });
  });
});
