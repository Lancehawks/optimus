"use client";

import { useState, useEffect } from "react";
import { Button, SearchBox, Spinner, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useBookmarks, useBookmarkMutations, useCollections } from "@/hooks/useBookmarks";
import { tagService } from "@/services/api";
import CollectionSidebar from "@/components/bookmarks/CollectionSidebar";
import BookmarkCard from "@/components/bookmarks/BookmarkCard";
import BookmarkModal from "@/components/bookmarks/BookmarkModal";

export default function BookmarksPage() {
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const { addToast } = useToast();

  const filters = {
    ...(selectedCollectionId ? { collection_id: selectedCollectionId } : {}),
    ...(search ? { search } : {}),
  };

  const { bookmarks, isLoading, refetch } = useBookmarks(filters);
  const { createBookmark, updateBookmark, deleteBookmark, isLoading: isMutating } = useBookmarkMutations(refetch);
  const { collections, createCollection, updateCollection, deleteCollection } = useCollections();

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const data = await tagService.list();
        setAvailableTags(data.tags);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };
    fetchTags();
  }, []);

  const handleOpenCreate = () => {
    setEditingBookmark(null);
    setShowModal(true);
  };

  const handleOpenEdit = (bookmark) => {
    setEditingBookmark(bookmark);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBookmark(null);
  };

  const handleSave = async (data) => {
    try {
      if (editingBookmark) {
        await updateBookmark(editingBookmark.id, data);
        addToast({ message: "Bookmark updated", type: "success" });
      } else {
        await createBookmark({
          ...data,
          collectionId: data.collectionId || selectedCollectionId,
        });
        addToast({ message: "Bookmark added", type: "success" });
      }
      handleCloseModal();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBookmark(id);
      addToast({ message: "Bookmark deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Collection sidebar */}
      <CollectionSidebar
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        onSelectCollection={(id) => setSelectedCollectionId(id)}
        onCreateCollection={createCollection}
        onRenameCollection={updateCollection}
        onDeleteCollection={deleteCollection}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-h1">Bookmarks</h1>
            <Button
              onClick={handleOpenCreate}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Add Bookmark
            </Button>
          </div>

          <SearchBox
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="sm:max-w-xs"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : bookmarks.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              }
              title="No bookmarks yet"
              description={search ? "No bookmarks match your search." : "Save your favorite links and organize them into collections."}
              action={!search ? { children: "Add Bookmark", onClick: handleOpenCreate } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {bookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bookmark modal */}
      <BookmarkModal
        isOpen={showModal}
        onClose={handleCloseModal}
        bookmark={editingBookmark}
        collections={collections}
        tags={availableTags}
        onSave={handleSave}
        isLoading={isMutating}
      />
    </div>
  );
}
