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
  const [mobilePane, setMobilePane] = useState("main"); // "main" | "collections"
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
        addToast({ message: "Link updated", type: "success" });
      } else {
        await createBookmark({
          ...data,
          collectionId: data.collectionId || selectedCollectionId,
        });
        addToast({ message: "Link added", type: "success" });
      }
      handleCloseModal();
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

  const activeCollectionName = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId)?.name
    : null;

  return (
    <div className="flex h-[calc(100dvh-56px)] lg:h-screen">
      {/* Collection sidebar — hidden on mobile unless mobilePane === "collections" */}
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
        className={mobilePane === "collections" ? "w-full lg:w-56" : "hidden lg:block w-56"}
        onBack={() => setMobilePane("main")}
      />

      {/* Main content area — hidden on mobile when viewing collections */}
      <div className={mobilePane === "collections" ? "hidden lg:flex flex-1 flex-col min-w-0" : "flex flex-1 flex-col min-w-0"}>
        {/* Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-h1 shrink-0">Reading List</h1>
              {/* Mobile: tap to open collections */}
              <button
                onClick={() => setMobilePane("collections")}
                className="lg:hidden flex items-center gap-1.5 text-body-sm text-muted hover:text-heading cursor-pointer shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <span className={activeCollectionName ? "text-brand-400!" : ""}>
                  {activeCollectionName ?? "Collections"}
                </span>
              </button>
            </div>
            <Button
              onClick={handleOpenCreate}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              <span className="hidden sm:inline">Add Link</span>
            </Button>
          </div>

          <SearchBox
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reading list..."
            className="sm:max-w-xs"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
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
              title="No links yet"
              description={search ? "No links match your search." : "Save links to read later and organize them into collections."}
              action={!search ? { children: "Add Link", onClick: handleOpenCreate } : undefined}
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
