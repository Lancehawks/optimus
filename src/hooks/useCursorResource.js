"use client";

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

const EMPTY_PAGINATION = {
  hasMore: false,
  nextCursor: null,
  totalCount: 0,
  filteredCount: 0,
};
const NO_ITEMS = [];

// A cursor-paginated list in the shared query cache. Returning to a list shows
// its cached pages at once and refreshes them in the background.
export function useCursorResource(queryKey, loadPage, itemKey, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => loadPage(pageParam, signal),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (
      lastPage.pagination?.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined
    ),
    enabled,
  });
  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch: refetchQuery } = query;

  const items = useMemo(() => data?.pages.flatMap((page) => page.items || []) ?? NO_ITEMS, [data]);
  const pagination = data?.pages.at(-1)?.pagination || EMPTY_PAGINATION;

  // Optimistic edits. A refresh already in flight is dropped so it can't
  // overwrite the edit; the write that follows refreshes the list again.
  const setItems = useCallback((update) => {
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, (current) => {
      const pages = current?.pages ?? [];
      const currentItems = pages.flatMap((page) => page.items || []);
      const nextItems = typeof update === "function" ? update(currentItems) : update;
      return {
        pages: [{ items: nextItems, pagination: pages.at(-1)?.pagination || EMPTY_PAGINATION }],
        pageParams: [current?.pageParams?.[0] ?? null],
      };
    });
  }, [queryClient, queryKey]);

  // Joins a refresh that is already running instead of restarting it.
  const refetch = useCallback(() => refetchQuery({ cancelRefetch: false }), [refetchQuery]);
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return null;
    return fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    [itemKey]: items,
    setItems,
    pagination,
    hasMore: Boolean(pagination?.hasMore),
    loadMore,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error,
    refetch,
  };
}
