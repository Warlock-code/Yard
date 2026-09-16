import { isNativeApp } from './platform'

export function blockIfNative(): boolean {
  if (isNativeApp()) {
    alert("Purchases aren't available in the app yet. Visit yardapp.me in your phone's browser to subscribe or buy.")
    return true
  }
  return false
}