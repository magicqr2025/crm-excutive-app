import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.whatscrm.executive',
  appName: 'executive-webapp',
  webDir: 'dist',
  // Temporary, for local push-notification testing only: the app's pages load
  // over https://localhost, and Chromium blocks that page from making a plain
  // HTTP request (to the LAN dev backend) as "mixed content" — a separate
  // policy from the Android network-security-config cleartext allowance.
  // Remove this once executive-webapp/.env is pointed back at the HTTPS
  // production backend.
  android: {
    allowMixedContent: true,
  },
}

export default config
