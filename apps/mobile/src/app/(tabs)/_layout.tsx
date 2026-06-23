import Ionicons from "@expo/vector-icons/Ionicons";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const TABS: { name: string; key: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", key: "tabs.home", icon: "home-outline", iconActive: "home" },
  { name: "check", key: "tabs.check", icon: "checkmark-done-circle-outline", iconActive: "checkmark-done-circle" },
  { name: "draws", key: "tabs.draws", icon: "trophy-outline", iconActive: "trophy" },
  { name: "wallet", key: "tabs.wallet", icon: "wallet-outline", iconActive: "wallet" },
  { name: "rates", key: "tabs.rates", icon: "trending-up-outline", iconActive: "trending-up" },
];

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const { colors } = theme;

  const settingsButton = () => (
    <Pressable
      onPress={() => router.push("/settings")}
      accessibilityRole="button"
      accessibilityLabel={t("settings.title")}
      hitSlop={12}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginHorizontal: 8 }}
    >
      <Ionicons name="settings-outline" size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: theme.fontFamily("bold"), fontWeight: theme.fontFamily() ? undefined : "700" },
        headerRight: settingsButton,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 64 },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily(),
          fontSize: 12,
          lineHeight: theme.locale === "ur" ? 22 : 16,
        },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.name === "index" ? t("common.appName") : t(tab.key),
            tabBarLabel: t(tab.key),
            tabBarAccessibilityLabel: t(tab.key),
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
