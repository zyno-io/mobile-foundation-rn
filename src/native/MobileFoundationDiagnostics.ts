import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface MobileFoundationDiagnosticsNativeModule {
  getExpoUpdatesDatabaseDiagnosticsAsync(): Promise<Record<string, unknown>>;
}

const nativeModule = Platform.OS === "ios"
  ? requireOptionalNativeModule<MobileFoundationDiagnosticsNativeModule>("MobileFoundationDiagnostics")
  : null;

export async function getExpoUpdatesDatabaseDiagnostics() {
  if (!nativeModule) {
    return {
      nativeModuleAvailable: false,
      platform: Platform.OS,
    };
  }

  const diagnostics = await nativeModule.getExpoUpdatesDatabaseDiagnosticsAsync();
  return {
    nativeModuleAvailable: true,
    platform: Platform.OS,
    ...diagnostics,
  };
}
