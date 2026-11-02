"use client";

import { cn } from "@/lib/utils";
import Button from "./Button";

export default function LoadMoreButton({ hasMore, isLoading, onLoadMore, className = "" }) {
  if (!hasMore) return null;
  return (
    <div className={cn("flex justify-center py-6", className)}>
      <Button type="button" variant="secondary" size="sm" onClick={onLoadMore} loading={isLoading}>
        {isLoading ? "Loading" : "Load more"}
      </Button>
    </div>
  );
}
