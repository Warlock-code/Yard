import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'me.yardapp.app',
  appName: 'Yard',
  webDir: 'out',
  server: {
    url: 'https://yardapp.me',
    cleartext: false,
    allowNavigation: [
      'yardapp.me',
      'www.yardapp.me',
      '*.yardapp.me',
      'checkout.paystack.com',
      '*.paystack.co',
      '*.paystack.com'
    ]
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      // Holds splash until BootGate calls hide() on first web paint.
      // launchAutoHide stays true as a native backstop: even if the web
      // never loads (dead network/CDN), the OS clears splash at 10s so
      // existing users can never get stuck on it.
      launchShowDuration: 10000,
      launchAutoHide: true,
      backgroundColor: "#050505",
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  }
}

export default config