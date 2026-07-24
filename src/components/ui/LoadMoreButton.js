"use client";

import Button from "./Button";

export default function LoadMoreButton({ hasMore, isLoading, onLoadMore, className = "" }) {
  if (!hasMore) return null;
  return (
    <div className={`flex justify-center py-5 ${className}`}>
      <Button type="button" variant="secondary" onClick={onLoadMore} disabled={isLoading}>
        {isLoading ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}
