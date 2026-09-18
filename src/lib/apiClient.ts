const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  errors: unknown[]

  constructor(message: string, status: number, errors: unknown[] = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export interface PaginationMeta {
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface Envelope<T> {
  success: boolean
  data?: T
  message?: string
  errors?: unknown[]
  meta?: PaginationMeta
}

async function requestEnvelope<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = (await res.json().catch(() => null)) as Envelope<T> | null

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status, body?.errors ?? [])
  }

  return body
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await requestEnvelope<T>(path, options)
  return body.data as T
}

// Like apiRequest, but preserves `meta` (pagination) and any other sibling
// top-level fields the backend sent alongside `data` (e.g. Deals' `summary`),
// instead of discarding everything but `data`.
export async function apiRequestWithMeta<T, Extra extends Record<string, unknown> = Record<string, never>>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: PaginationMeta } & Extra> {
  const body = await requestEnvelope<T>(path, options)
  return { ...(body as unknown as Extra), data: body.data as T, meta: body.meta }
}
