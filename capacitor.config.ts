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
      launchShowDuration: 1200,
      backgroundColor: "#050505",
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  }
}

export default config