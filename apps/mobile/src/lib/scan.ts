import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import { extractBondNumbers } from "./bond-input";

export type ScanResult =
  | { kind: "ok"; numbers: string[] }
  | { kind: "cancelled" }
  | { kind: "permissionDenied"; canAskAgain: boolean }
  | { kind: "unsupported" }
  | { kind: "failed" };

/**
 * Photographs (or picks) a bond and reads its serial numbers on the device with ML Kit text
 * recognition. Nothing is uploaded: only the recognised numbers are returned.
 */
export async function scanBondNumbers(source: "camera" | "library"): Promise<ScanResult> {
  if (!isSupported) return { kind: "unsupported" };
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { kind: "permissionDenied", canAskAgain: permission.canAskAgain };
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsEditing: false, exif: false };
    const picked =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets[0]) return { kind: "cancelled" };
    const lines = await extractTextFromImage(picked.assets[0].uri);
    return { kind: "ok", numbers: extractBondNumbers(lines) };
  } catch {
    return { kind: "failed" };
  }
}
