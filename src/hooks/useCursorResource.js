"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useCursorResource(loadPage, itemKey, { enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    hasMore: false,
    nextCursor: null,
    totalCount: 0,
    filteredCount: 0,
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const activeRequest = useRef(null);

  const requestPage = useCallback(async ({ cursor = null, append = false } = {}) => {
    if (!enabled) return null;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    append ? setIsLoadingMore(true) : setIsLoading(true);
    setError(null);

    try {
      const result = await loadPage(cursor, controller.signal);
      if (controller.signal.aborted) return null;
      const nextItems = result.items || [];
      setItems((current) => {
        if (!append) return nextItems;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !seen.has(item.id))];
      });
      setPagination(result.pagination || {});
      return result;
    } catch (requestError) {
      if (requestError?.name !== "AbortError" && !controller.signal.aborted) setError(requestError);
      return null;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      append ? setIsLoadingMore(false) : setIsLoading(false);
    }
  }, [enabled, loadPage]);

  const refetch = useCallback(() => requestPage(), [requestPage]);
  const loadMore = useCallback(() => {
    if (!pagination?.hasMore || !pagination?.nextCursor || isLoadingMore) return null;
    return requestPage({ cursor: pagination.nextCursor, append: true });
  }, [isLoadingMore, pagination?.hasMore, pagination?.nextCursor, requestPage]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setIsLoading(false);
      return undefined;
    }
    refetch();
    return () => activeRequest.current?.abort();
  }, [enabled, refetch]);

  return {
    [itemKey]: items,
    setItems,
    pagination,
    hasMore: Boolean(pagination?.hasMore),
    loadMore,
    isLoading,
    isLoadingMore,
    error,
    refetch,
  };
}
