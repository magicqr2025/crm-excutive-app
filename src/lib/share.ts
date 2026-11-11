/**
 * Opens the phone's share sheet (WhatsApp, SMS, email…) for a link. Where the device or browser has none, the link
 * is copied instead. Returns what happened so the caller can tell the person.
 */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (err) {
      // Closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(data.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
