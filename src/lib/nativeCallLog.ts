import { registerPlugin } from '@capacitor/core'

export interface NativeCallLogEntry {
  id: string
  number: string
  type: 'incoming' | 'outgoing' | 'missed'
  date: number
  duration: number
}

export type CallLogPermissionState = 'granted' | 'denied' | 'prompt'

export interface CallLogSyncPlugin {
  checkPermissions(): Promise<{ callLog: CallLogPermissionState }>
  requestPermissions(): Promise<{ callLog: CallLogPermissionState }>
  getNewCalls(): Promise<{ calls: NativeCallLogEntry[] }>
  markSynced(options: { lastId: string }): Promise<void>
  startBackgroundSync(): Promise<void>
  addListener(eventName: 'callEnded', listenerFunc: () => void): Promise<{ remove: () => void }>
}

export const CallLogSync = registerPlugin<CallLogSyncPlugin>('CallLogSync')
