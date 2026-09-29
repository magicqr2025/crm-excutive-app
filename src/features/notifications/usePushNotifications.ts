import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { registerFcmToken } from '@/api/crmApi'
import { useToast } from '@/components/ui/useToast'

// Sent by crmbackend's reminder job (see crmbackend src/jobs/followupReminderJob.js):
// data = { entityType: 'followup' | 'meeting', entityId: string }.
function routeFor(data: Record<string, string> | undefined): string | null {
  if (data?.entityType === 'followup' && data.entityId) return `/followups/${data.entityId}`
  if (data?.entityType === 'meeting') return '/meetings'
  return null
}

// Asks for notification permission, gets this device's FCM token and registers
// it with crmbackend. Mounted only inside the authenticated shell, so it runs
// after every login. A no-op outside the native app (browser dev server).
//
// Needs android/app/google-services.json from the Firebase console — without it
// the native push plugin has no Firebase app to register with.
export function usePushNotifications() {
  const navigate = useNavigate()
  const toast = useToast()
  // Latest navigate/toast for the listeners below. The toast context value is a
  // new object whenever a toast appears, so depending on it directly would tear
  // down and re-register push on every toast.
  const latest = useRef({ navigate, toast })
  useEffect(() => {
    latest.current = { navigate, toast }
  })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false
    const handles: Promise<{ remove: () => Promise<void> }>[] = []

    // Listeners first, so the token event from register() below can't be missed.
    handles.push(
      PushNotifications.addListener('registration', ({ value }) => {
        registerFcmToken(value).catch((err) => console.error('Failed to register push token', err))
      }),
      PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error', err)
      }),
      // Foreground: Android doesn't show a system notification while the app is open.
      PushNotifications.addListener('pushNotificationReceived', (n) => {
        latest.current.toast.show({ title: n.title ?? 'Reminder', description: n.body })
      }),
      // The user tapped a notification (app was backgrounded or closed).
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const to = routeFor(notification.data as Record<string, string> | undefined)
        if (to) latest.current.navigate(to)
      }),
    )

    void (async () => {
      let { receive } = await PushNotifications.checkPermissions()
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        ;({ receive } = await PushNotifications.requestPermissions())
      }
      if (receive !== 'granted' || cancelled) return
      await PushNotifications.register()
    })().catch((err) => console.error('Push setup failed', err))

    return () => {
      cancelled = true
      handles.forEach((h) => void h.then((handle) => handle.remove()))
    }
  }, [])
}
