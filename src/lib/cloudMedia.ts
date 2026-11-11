import { ApiError } from './apiClient'

// Pictures for quick replies are stored in the media bucket through the login service (backend.magicqr.in).
// A staff login has no session there, so it uses that service's public upload route (no login; it picks the
// same bucket from the business id). Three steps: ask for a short-lived upload address, PUT the file straight
// to storage, keep the public address it returns. WhatsApp downloads the picture from that address.

const MEDIA_BASE_URL =
  ((import.meta.env.VITE_MEDIA_BACKEND_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_LOGIN_BACKEND_URL as string | undefined) ||
    'https://backend.magicqr.in/api/v1').replace(/\/$/, '')

export const IMAGE_RULES = { types: ['image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024, hint: 'png, jpg — up to 5 MB' }

interface PresignedUpload {
  uploadUrl: string
  key: string
  publicUrl: string
}

/** Uploads the picture and returns its public https address. Throws an Error with a message fit to show the user. */
export async function uploadImage(businessId: string, file: File): Promise<string> {
  if (!IMAGE_RULES.types.includes(file.type)) throw new Error(`WhatsApp only accepts a PNG or JPG image here (${IMAGE_RULES.hint}).`)
  if (file.size > IMAGE_RULES.maxBytes) throw new Error(`That picture is too large — ${IMAGE_RULES.hint}.`)

  const res = await fetch(`${MEDIA_BASE_URL}/public/businesses/${encodeURIComponent(businessId)}/media/presign`, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
  })
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: PresignedUpload; message?: string } | null
  if (!res.ok || !body?.success || !body.data) throw new ApiError(body?.message ?? `Could not start the upload (${res.status})`, res.status)

  const put = await fetch(body.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  if (!put.ok) throw new Error(`The upload to storage failed (${put.status}). Please try again.`)
  return body.data.publicUrl
}
