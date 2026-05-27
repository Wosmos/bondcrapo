/** expo-router stand-in for screen tests: navigation calls are recorded, params are injectable. */
import { useEffect } from "react";

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
};

let params: Record<string, string> = {};
export const setParams = (next: Record<string, string>) => {
  params = next;
};
export const useLocalSearchParams = () => params;
export const useFocusEffect = (cb: () => void) => useEffect(cb, [cb]);
export const Stack = Object.assign(() => null, { Screen: () => null });
export const Tabs = Object.assign(() => null, { Screen: () => null });
