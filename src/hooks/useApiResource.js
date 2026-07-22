"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useApiResource(load, { initialValue = null, enabled = true } = {}) {
  const [data, setData] = useState(initialValue);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const activeRequest = useRef(null);
  const initialValueRef = useRef(initialValue);

  const refetch = useCallback(async (options = {}) => {
    const background = options?.background === true;
    if (!enabled) {
      activeRequest.current?.abort();
      setData(initialValueRef.current);
      setError(null);
      setIsLoading(false);
      return null;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!background) setIsLoading(true);
    setError(null);

    try {
      const result = await load(controller.signal);
      if (!controller.signal.aborted) setData(result);
      return result;
    } catch (requestError) {
      if (requestError?.name === "AbortError" || controller.signal.aborted) return null;
      setError(requestError);
      return null;
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
      }
    }
  }, [enabled, load]);

  useEffect(() => {
    refetch();
    return () => {
      const request = activeRequest.current;
      activeRequest.current = null;
      request?.abort();
    };
  }, [refetch]);

  return { data, error, isLoading, refetch, setData };
}
