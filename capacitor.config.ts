import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'me.yardapp.app',
  appName: 'Yard',
  webDir: 'public',
 server: {
  url: 'https://yard-khaki.vercel.app',
  cleartext: false
}
}

export default config