import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'
import type { PageResult } from '@/lib/paging'

interface Options<T> {
  queryKey: QueryKey
  fetchPage: (page: number) => Promise<PageResult<T>>
  enabled?: boolean
}

// Infinite-scroll list: page 1 loads on mount, fetchNextPage appends the next
// one. A new queryKey (search text, tab, scope) starts again from page 1.
export function usePagedList<T>({ queryKey, fetchPage, enabled = true }: Options<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  })
  return {
    items: query.data?.pages.flatMap((p) => p.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    summary: query.data?.pages[0]?.summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
