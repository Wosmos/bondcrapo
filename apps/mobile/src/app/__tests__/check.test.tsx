import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage } from "expo-text-extractor";
import CheckScreen from "../(tabs)/check";
import { mockApi, ok, renderScreen } from "@/test-utils/render";

describe("Check screen", () => {
  it("checks typed numbers and ranges and announces the wins", async () => {
    const api = mockApi(({ method, path, body }) => {
      if (method === "POST" && path === "/bonds/check") {
        expect(body).toEqual({ items: [{ number: "482913" }, { from: "100000", to: "100002" }] });
        return ok({
          checked: 4,
          wins: [
            { bondNumber: "482913", denominationCode: "750", drawId: 501, drawNumber: 104, drawDate: "2026-04-15", tier: 1, amountPkr: 1500000 },
          ],
        });
      }
    });
    await renderScreen(<CheckScreen />);

    await fireEvent.changeText(screen.getByLabelText("Bond numbers"), "482913\n100000-100002");
    expect(screen.getByText("4 numbers ready to check")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Check now" }));

    expect(await screen.findByText("Congratulations! 1 win in 4 numbers.")).toBeTruthy();
    expect(screen.getByText("Rs 1,500,000")).toBeTruthy();
    expect(screen.getByText("First prize")).toBeTruthy();
    expect(api.calls).toHaveLength(1);
  });

  it("explains invalid input and keeps the button disabled", async () => {
    mockApi(() => undefined);
    await renderScreen(<CheckScreen />);
    await fireEvent.changeText(screen.getByLabelText("Bond numbers"), "12345");
    expect(screen.getByText("These are not six digit numbers: 12345")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check now" })).toBeDisabled();
  });

  it("fills the field from a camera scan read on the device", async () => {
    mockApi(() => undefined);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///bond.jpg", width: 1, height: 1 }],
    } as ImagePicker.ImagePickerResult);
    jest.mocked(extractTextFromImage).mockResolvedValueOnce(["PRIZE BOND Rs 750", "No. 482913", "000017"]);
    await renderScreen(<CheckScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Scan with camera" }));
    expect(await screen.findByText("Found 2 numbers. Review them above before checking.")).toBeTruthy();
    expect(screen.getByLabelText("Bond numbers").props.value).toBe("482913\n000017");
  });

  it("offers manual entry when the camera permission is refused", async () => {
    mockApi(() => undefined);
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await renderScreen(<CheckScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Scan with camera" }));
    expect(await screen.findByText("Camera access was not allowed. You can type the numbers instead.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open phone settings" })).toBeTruthy();
  });

  it("shows a friendly state when the server is unreachable", async () => {
    mockApi(() => ({ status: 503, body: { error: { code: "unavailable", message: "down" } } }));
    await renderScreen(<CheckScreen />);
    await fireEvent.changeText(screen.getByLabelText("Bond numbers"), "482913");
    await fireEvent.press(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(screen.getByText("Service unavailable")).toBeTruthy());
  });
});
