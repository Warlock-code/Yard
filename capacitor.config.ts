import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'me.yardapp.app',
  appName: 'Yard',
  webDir: 'public',
  server: {
    url: 'https://yardapp.me',
    cleartext: false,
    allowNavigation: [
      'yardapp.me',
      '*.yardapp.me'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#050505",
      showSpinner: false
    }
  }
}

export default config