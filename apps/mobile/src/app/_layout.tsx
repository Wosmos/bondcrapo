import "@/lib/background";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { applyLayoutDirection, I18nProvider, useI18n } from "@/i18n";
import { notifyNewWins, syncDrawReminders } from "@/lib/notifications";
import { loadSettings, SettingsProvider, useSettings, type Settings } from "@/lib/settings";
import { UpdateProvider, useUpdate } from "@/lib/update-context";
import { WalletProvider } from "@/lib/wallet";
import { ThemeProvider, useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void (async () => {
      const loaded = await loadSettings();
      // Urdu needs a right to left layout; React Native applies it on the next start.
      const reloading = await applyLayoutDirection(loaded.locale).catch(() => false);
      if (!reloading) setSettings(loaded);
    })();
  }, []);

  if (!settings) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider initial={settings}>
        <Providers />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function Providers() {
  const { settings } = useSettings();
  return (
    <I18nProvider locale={settings.locale}>
      <ThemeProvider preference={settings.theme} locale={settings.locale}>
        <WalletProvider>
          <UpdateProvider>
            <Navigator />
          </UpdateProvider>
        </WalletProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

function Navigator() {
  const theme = useTheme();
  const { t } = useI18n();
  const { settings } = useSettings();
  const update = useUpdate();
  const checkedUpdate = useRef(false);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
    void SplashScreen.hideAsync();
  }, [theme.colors.background]);

  // Release manifest: a required update blocks the app behind the update screen.
  useEffect(() => {
    if (checkedUpdate.current) return;
    checkedUpdate.current = true;
    update
      .check()
      .then((state) => {
        if (state.kind === "required") router.push("/update");
      })
      .catch(() => undefined);
  }, [update]);

  // New wins and the draw reminder plan are refreshed whenever the app comes to the foreground
  // (the background task does the same while the app is closed).
  useEffect(() => {
    if (!settings.winAlerts && !settings.drawReminders) return;
    const run = () => {
      if (settings.winAlerts) void notifyNewWins(settings.locale).catch(() => undefined);
      if (settings.drawReminders) void syncDrawReminders(settings.locale, true).catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener("change", (s) => s === "active" && run());
    return () => sub.remove();
  }, [settings.winAlerts, settings.drawReminders, settings.locale]);

  // Tapping a notification opens the screen it refers to.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  const headerTitleStyle = { fontFamily: theme.fontFamily("bold"), fontWeight: theme.fontFamily() ? undefined : ("700" as const) };

  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="draws/[code]/index" options={{ title: t("draws.title") }} />
        <Stack.Screen name="draws/[code]/[number]" options={{ title: t("draw.title") }} />
        <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
        <Stack.Screen name="wallet/add" options={{ title: t("walletAdd.title"), presentation: "modal" }} />
        <Stack.Screen name="wallet/restore" options={{ title: t("walletRestore.title") }} />
        <Stack.Screen name="wallet/created" options={{ title: t("walletCreated.title"), headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="update" options={{ title: t("update.title"), presentation: "modal" }} />
      </Stack>
    </>
  );
}
