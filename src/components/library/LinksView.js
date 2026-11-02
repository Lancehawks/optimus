"use client";

import { useEffect, useState } from "react";
import { Bookmark, Folder, Plus } from "lucide-react";
import { Button, EmptyState, SearchBox, useToast } from "@/components/ui";
import { useBookmarks, useBookmarkMutations, useCollections } from "@/hooks/useBookmarks";
import { tagService } from "@/services/api";
import CollectionSidebar from "@/components/bookmarks/CollectionSidebar";
import BookmarkCard from "@/components/bookmarks/BookmarkCard";
import BookmarkModal from "@/components/bookmarks/BookmarkModal";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

export default function LinksView({ initialSearch = "" }) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [search, setSearch] = useState(initialSearch);
  const [showModal, setShowModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [mobilePane, setMobilePane] = useState("main");
  const { addToast } = useToast();

  const filters = {
    ...(selectedCollectionId ? { collection_id: selectedCollectionId } : {}),
    ...(search ? { search } : {}),
  };

  const { bookmarks, pagination, isLoading, refetch, hasMore, loadMore, isLoadingMore } = useBookmarks(filters);
  const { createBookmark, updateBookmark, deleteBookmark, isLoading: isMutating } = useBookmarkMutations(refetch);
  const { collections, createCollection, updateCollection, deleteCollection } = useCollections();

  useEffect(() => {
    tagService
      .list()
      .then((data) => setAvailableTags(data.tags))
      .catch((error) => console.error("Failed to fetch tags:", error));
  }, []);

  useEffect(() => {
    setSearch((prev) => (prev === initialSearch ? prev : initialSearch));
  }, [initialSearch]);

  const openCreate = () => {
    setEditingBookmark(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBookmark(null);
  };

  const handleSave = async (data) => {
    try {
      if (editingBookmark) {
        await updateBookmark(editingBookmark.id, data);
        addToast({ message: "Link updated", type: "success" });
      } else {
        await createBookmark({ ...data, collectionId: data.collectionId || selectedCollectionId });
        addToast({ message: "Link saved", type: "success" });
      }
      closeModal();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBookmark(id);
      addToast({ message: "Link deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const activeCollectionName = selectedCollectionId ? collections.find((c) => c.id === selectedCollectionId)?.name : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[12rem_1fr]">
      <CollectionSidebar
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        onSelectCollection={(id) => {
          setSelectedCollectionId(id);
          setMobilePane("main");
        }}
        onCreateCollection={createCollection}
        onRenameCollection={updateCollection}
        onDeleteCollection={deleteCollection}
        className={mobilePane === "collections" ? "block" : "hidden lg:block"}
        onBack={() => setMobilePane("main")}
      />

      <div className={mobilePane === "collections" ? "hidden lg:block" : "min-w-0"}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search links" />
          </div>
          <button
            type="button"
            onClick={() => setMobilePane("collections")}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-body hover:text-heading lg:hidden"
          >
            <Folder className="h-3.5 w-3.5" />
            {activeCollectionName ?? "Collections"}
          </button>
          <span className="ml-auto font-mono text-xs text-muted">{pagination.filteredCount || 0} links</span>
          <Button onClick={openCreate} leftIcon={<Plus />} aria-label="Add link">
            Add link
          </Button>
        </div>

        {isLoading ? (
          <div className="card divide-y divide-border">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 px-4 py-3.5">
                <div className="skeleton h-8 w-8 rounded-lg" />
                <div className="skeleton h-3.5 flex-1" />
              </div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Bookmark />}
              title={search ? "No matching links" : "Nothing saved yet"}
              description={search ? "Try a different search." : "Keep the pages worth returning to, and sort them into collections."}
              action={!search ? { children: "Add link", onClick: openCreate, leftIcon: <Plus /> } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="card divide-y divide-border overflow-hidden">
              {bookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={(item) => {
                    setEditingBookmark(item);
                    setShowModal(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
          </>
        )}
      </div>

      <BookmarkModal
        isOpen={showModal}
        onClose={closeModal}
        bookmark={editingBookmark}
        collections={collections}
        tags={availableTags}
        onSave={handleSave}
        isLoading={isMutating}
      />
    </div>
  );
}
