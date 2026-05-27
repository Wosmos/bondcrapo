import { configure } from "@testing-library/react-native";

// Slow CI runners and low-end machines: give async queries room.
configure({ asyncUtilTimeout: 15000 });

/* Native module mocks shared by every test. Network calls are always stubbed per test. */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

jest.mock("expo-text-extractor", () => ({
  isSupported: true,
  extractTextFromImage: jest.fn(async () => []),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ timeZone: "Asia/Karachi" }],
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.2.0",
  nativeBuildVersion: "10200",
}));

jest.mock("expo-router", () => require("./src/test-utils/router-mock"));

beforeEach(async () => {
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await AsyncStorage.clear();
  require("expo-secure-store").__store.clear();
  require("./src/test-utils/router-mock").setParams({});
});

// Icon fonts are native assets; render a plain glyph placeholder in tests.
jest.mock("@expo/vector-icons/Ionicons", () => {
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text accessibilityElementsHidden>{`[${name}]`}</Text>;
  return { __esModule: true, default: Icon };
});
