import type { PaginationMeta } from '@/lib/apiClient'

// Rows per request for every server-paged list. One constant so the page size
// can be changed in a single place.
export const PAGE_SIZE = 10

export interface PageResult<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
  /** Whole-result aggregates the backend sends beside `meta` (e.g. deal/payment totals). */
  summary?: Record<string, number>
}

// Lists that ask for a page always get `meta` back; the fallback only covers
// an older backend that ignores `page` and returns everything.
export function toPageResult<T>(data: T[], meta: PaginationMeta | undefined, summary?: Record<string, number>): PageResult<T> {
  return {
    items: data,
    page: meta?.page ?? 1,
    totalPages: meta?.total_pages ?? 1,
    total: meta?.total ?? data.length,
    summary,
  }
}
