import { isNativeApp } from './platform'

export function blockIfNative(): boolean {
  if (isNativeApp()) {
    alert("Purchases aren't available in the app yet. Visit yardapp.me in your phone's browser to subscribe or buy.")
    return true
  }
  return false
}

export async function openPaystackCheckout(url: string) {
  if (isNativeApp()) {
    try {
      const { Browser } = await import("@capacitor/browser")
      await Browser.open({ url, windowName: "_blank", presentationStyle: "popover" })
      return
    } catch {
      // fallback to system browser
      window.open(url, "_blank")
      return
    }
  }
  window.location.href = url
}