// Single source of truth for the Android app version.
// Bump these on every native release (must match android/app/build.gradle
// versionCode/versionName + the GitHub Release tag). The in-app UpdateGate
// reads them to banner or block outdated installs — no manual user chasing.
//
// NOTE: v1.0.0 (build 1) was signed with a different key, so MIN_BUILD = 2
// forces those users to the update screen (they must uninstall v1.0.0 first).
export const APP_VERSION = {
  ANDROID_LATEST_BUILD: 2,
  ANDROID_LATEST_VERSION: "1.0.1",
  ANDROID_MIN_BUILD: 2,
  APK_URL: "https://github.com/Warlock-code/Yard/releases/download/v1.0.1/Yard-v1.0.1.apk",
} as const
