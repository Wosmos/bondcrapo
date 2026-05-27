import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import WalletScreen from "../(tabs)/wallet";
import { router } from "@/test-utils/router-mock";
import { SYNC_CODE, WALLET_ID, WALLET_TOKEN } from "@/test-utils/fixtures";
import { mockApi, ok, renderScreen } from "@/test-utils/render";
import { writeCredentials } from "@/lib/wallet-store";

describe("Wallet screen", () => {
  it("creates an anonymous wallet and keeps the token in secure storage", async () => {
    mockApi(({ method, path }) =>
      method === "POST" && path === "/wallets" ? ok({ walletId: WALLET_ID, token: WALLET_TOKEN, syncCode: SYNC_CODE }) : undefined,
    );
    await renderScreen(<WalletScreen />);

    await fireEvent.press(await screen.findByRole("button", { name: "Create my wallet" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/wallet/created"));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "bondcheck.wallet.credentials",
      JSON.stringify({ walletId: WALLET_ID, token: WALLET_TOKEN }),
      expect.anything(),
    );
  });

  it("lists saved bonds by denomination and sends the wallet header", async () => {
    await writeCredentials({ walletId: WALLET_ID, token: WALLET_TOKEN }, SYNC_CODE);
    const api = mockApi(({ path }) => {
      if (path === "/wallets/me/bonds")
        return ok([
          { denominationCode: "750", bondNumber: "482913", label: "Ammi", addedAt: "2026-05-01T00:00:00Z" },
          { denominationCode: "200", bondNumber: "000017", label: null, addedAt: "2026-05-01T00:00:00Z" },
        ]);
      if (path === "/wallets/me/matches")
        return ok([
          {
            drawId: 501,
            denominationCode: "750",
            drawNumber: 104,
            drawDate: "2026-04-15",
            bondNumber: "482913",
            tier: 1,
            amountPkr: 1500000,
            matchedAt: "2026-04-16T00:00:00Z",
            seenAt: null,
          },
        ]);
    });
    await renderScreen(<WalletScreen />);

    expect(await screen.findByText("482913")).toBeTruthy();
    expect(screen.getByText("Rs 750 (1)")).toBeTruthy();
    expect(screen.getByText("Rs 200 (1)")).toBeTruthy();
    expect(screen.getByText("You have 1 new win")).toBeTruthy();
    expect(screen.getByText("Computed from denominations")).toBeTruthy();
    expect(api.calls.every((c) => c.headers.Authorization === `Wallet ${WALLET_ID}.${WALLET_TOKEN}`)).toBe(true);
  });

  it("offers restore when the server no longer accepts the token", async () => {
    await writeCredentials({ walletId: WALLET_ID, token: WALLET_TOKEN }, SYNC_CODE);
    mockApi(() => ({ status: 401, body: { error: { code: "unauthorized", message: "no" } } }));
    await renderScreen(<WalletScreen />);
    expect(await screen.findByText("This wallet needs to be restored")).toBeTruthy();
  });
});
