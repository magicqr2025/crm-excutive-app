import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { registerFcmToken } from '@/api/crmApi'
import { useToast } from '@/components/ui/useToast'

// Sent by crmbackend's reminder job (see crmbackend src/jobs/followupReminderJob.js):
// data = { entityType: 'followup' | 'meeting', entityId: string }.
function routeFor(data: Record<string, string> | undefined): string | null {
  if (data?.entityType === 'followup' && data.entityId) return `/followups/${data.entityId}`
  if (data?.entityType === 'meeting') return '/meetings'
  if (data?.entityType === 'subscription') return '/subscriptions'
  return null
}

// Android doesn't show a system notification for an FCM message while the app
// is in the foreground — it's left to the app. We post one ourselves via
// Local Notifications so a reminder looks the same whether the app is open,
// backgrounded, or closed. Capped to int32 (LocalNotifications requires a
// numeric id) and de-duplicated per push by reusing its own id/tag.
function localNotificationId(pushId: string | undefined): number {
  if (!pushId) return Date.now() % 2147483647
  let hash = 0
  for (let i = 0; i < pushId.length; i++) hash = (hash * 31 + pushId.charCodeAt(i)) | 0
  return Math.abs(hash) % 2147483647
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
      // Foreground: post a real system notification ourselves (see localNotificationId
      // above) so it's visible the same way as the backgrounded/closed case, plus an
      // in-app toast for whoever is looking at the screen right now.
      PushNotifications.addListener('pushNotificationReceived', (n) => {
        latest.current.toast.show({ title: n.title ?? 'Reminder', description: n.body })
        const data = (n.data ?? {}) as Record<string, string>
        LocalNotifications.schedule({
          notifications: [
            {
              id: localNotificationId(n.id),
              title: n.title ?? 'Reminder',
              body: n.body ?? '',
              extra: data,
            },
          ],
        }).catch((err) => console.error('Failed to post local notification', err))
      }),
      // The user tapped a notification (app was backgrounded or closed).
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const to = routeFor(notification.data as Record<string, string> | undefined)
        if (to) latest.current.navigate(to)
      }),
      // The user tapped the notification we posted ourselves above (foreground case).
      LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        const to = routeFor(notification.extra as Record<string, string> | undefined)
        if (to) latest.current.navigate(to)
      }),
    )

    void (async () => {
      let { receive } = await PushNotifications.checkPermissions()
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        ;({ receive } = await PushNotifications.requestPermissions())
      }
      // Local Notifications tracks its own permission state even though it's the
      // same OS permission as push on Android — request it too, best-effort.
      await LocalNotifications.requestPermissions().catch(() => {})
      if (receive !== 'granted' || cancelled) return
      await PushNotifications.register()
    })().catch((err) => console.error('Push setup failed', err))

    return () => {
      cancelled = true
      handles.forEach((h) => void h.then((handle) => handle.remove()))
    }
  }, [])
}
