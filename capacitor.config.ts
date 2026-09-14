import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'me.yardapp.app',
  appName: 'Yard',
  webDir: 'public',
 server: {
  url: 'https://yardapp.me',
  cleartext: false
}
}

export default config