"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button, EmptyState, SearchBox, Spinner, Tabs, useToast } from "@/components/ui";
import { useResources, useResourceMutations } from "@/hooks/useResources";
import { useFlashcardDecks, useDeckCards, useFlashcardMutations } from "@/hooks/useFlashcards";
import { useReadingList, useReadingListMutations } from "@/hooks/useReadingList";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import ResourceCard from "@/components/resources/ResourceCard";
import ResourceModal from "@/components/resources/ResourceModal";
import FlashcardDeckCard from "@/components/resources/FlashcardDeckCard";
import FlashcardModal from "@/components/resources/FlashcardModal";
import FlashcardStudy from "@/components/resources/FlashcardStudy";
import ReadingListItem from "@/components/resources/ReadingListItem";
import ReadingListModal from "@/components/resources/ReadingListModal";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { useAuth } from "@/context/AuthContext";

const mainTabs = [
  { key: "resources", label: "Resources" },
  { key: "flashcards", label: "Flashcards" },
  { key: "reading", label: "Reading List" },
];

const typeFilters = ["all", "pdf", "doc", "image", "link", "other"];

const readingStatusFilters = [
  { key: "", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "reading", label: "Reading" },
  { key: "completed", label: "Completed" },
];

export default function ResourcesPage() {
  const searchParams = useSearchParams();
  const querySearch = searchParams.get("search") || "";
  const { addToast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("resources");

  // Resources state
  const [resourceSearch, setResourceSearch] = useState(querySearch);
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);

  // Flashcards state
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);
  const [editingDeckCards, setEditingDeckCards] = useState([]);
  const [studyDeck, setStudyDeck] = useState(null);

  // Reading list state
  const [readingStatusFilter, setReadingStatusFilter] = useState("");
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [editingReadingItem, setEditingReadingItem] = useState(null);

  // Resources hooks
  const { resources, pagination: resourcePagination, isLoading: resourcesLoading, refetch: refetchResources, hasMore: hasMoreResources, loadMore: loadMoreResources, isLoadingMore: isLoadingMoreResources } = useResources({
    type: resourceTypeFilter !== "all" ? resourceTypeFilter : "",
    search: resourceSearch,
  });
  const { createResource, updateResource, deleteResource, isLoading: resourceMutating } = useResourceMutations(() => {
    refetchResources();
    setResourceModalOpen(false);
    setEditingResource(null);
  });

  useEffect(() => {
    setResourceSearch((prev) => (prev === querySearch ? prev : querySearch));
    if (querySearch) setActiveTab("resources");
  }, [querySearch]);

  // Flashcards hooks
  const { decks, isLoading: decksLoading, refetch: refetchDecks } = useFlashcardDecks();
  const { cards: deckCardsForEdit, refetch: refetchDeckCards } = useDeckCards(editingDeck?.id);
  const {
    createDeck, updateDeck, deleteDeck,
    addCard, updateCard, deleteCard,
    isLoading: flashcardMutating,
  } = useFlashcardMutations(() => {
    refetchDecks();
    if (editingDeck?.id) {
      refetchDeckCards();
    }
  });

  // Reading list hooks
  const { items: readingItems, isLoading: readingLoading, refetch: refetchReading } = useReadingList({
    status: readingStatusFilter,
  });
  const { createItem, updateItem, deleteItem, isLoading: readingMutating } = useReadingListMutations(() => {
    refetchReading();
    setReadingModalOpen(false);
    setEditingReadingItem(null);
  });
  const canEditReadingItem = (item) => item?.user_id === user?.id || item?.is_project_owner;
  const canDeleteReadingItem = (item) => (
    item?.project_id ? Boolean(item?.is_project_owner) : item?.user_id === user?.id
  );

  // Resource handlers
  const handleResourceSave = async (data) => {
    try {
      if (data._delete) {
        await deleteResource(data.id);
        addToast("Resource deleted", "success");
        return;
      }
      if (data.id) {
        await updateResource(data.id, data);
        addToast("Resource updated", "success");
      } else {
        await createResource(data);
        addToast("Resource created", "success");
      }
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleResourceEdit = (resource) => {
    setEditingResource(resource);
    setResourceModalOpen(true);
  };

  const handleResourceDelete = async (resource) => {
    try {
      await deleteResource(resource.id);
      addToast("Resource deleted", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  // Flashcard handlers
  const handleDeckEdit = async (deck) => {
    setEditingDeck(deck);
    setDeckModalOpen(true);
  };

  const handleDeckSave = async (data) => {
    try {
      if (data.id) {
        await updateDeck(data.id, { name: data.name, description: data.description });
        addToast("Deck updated", "success");
      } else {
        const newDeck = await createDeck({ name: data.name, description: data.description });
        setEditingDeck(newDeck);
        addToast("Deck created", "success");
      }
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleDeckDelete = async (deck) => {
    try {
      await deleteDeck(deck.id);
      addToast("Deck deleted", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleAddCard = async (deckId, data) => {
    try {
      await addCard(deckId, data);
      addToast("Card added", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleUpdateCard = async (deckId, cardId, data) => {
    try {
      await updateCard(deckId, cardId, data);
      addToast("Card updated", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleDeleteCard = async (deckId, cardId) => {
    try {
      await deleteCard(deckId, cardId);
      addToast("Card deleted", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleStudy = (deck) => {
    setStudyDeck(deck);
  };

  const handleCloseStudy = () => {
    setStudyDeck(null);
    refetchDecks();
  };

  // Reading list handlers
  const handleReadingSave = async (data) => {
    try {
      if (data._delete) {
        if (!canDeleteReadingItem(editingReadingItem)) return;
        await deleteItem(data.id);
        addToast("Item deleted", "success");
        return;
      }
      if (data.id) {
        if (!canEditReadingItem(editingReadingItem)) return;
        await updateItem(data.id, data);
        addToast("Item updated", "success");
      } else {
        await createItem(data);
        addToast("Item added", "success");
      }
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleReadingEdit = (item) => {
    if (!canEditReadingItem(item)) return;
    setEditingReadingItem(item);
    setReadingModalOpen(true);
  };

  const handleReadingDelete = async (item) => {
    if (!canDeleteReadingItem(item)) return;
    try {
      await deleteItem(item.id);
      addToast("Item deleted", "success");
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const handleStatusChange = async (id, status) => {
    const item = readingItems.find((candidate) => candidate.id === id);
    if (!canEditReadingItem(item)) return;
    try {
      const updates = { status };
      if (status === "completed") updates.progress = 100;
      await updateItem(id, updates);
      refetchReading();
    } catch (error) {
      addToast(error.message, "error");
    }
  };

  const activeCount = activeTab === "resources"
    ? resourcePagination.filteredCount || 0
    : activeTab === "flashcards"
      ? decks.length
      : readingItems.length;
  const activeLabel = mainTabs.find((tab) => tab.key === activeTab)?.label || "Items";

  return (
    <div className="mx-auto max-w-[1480px] p-6">
      <PageHeader
        title="Study Resources"
        description={activeLabel}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        }
        meta={<PageHeaderStat label={activeCount === 1 ? "item" : "items"} value={activeCount} tone="brand" />}
      />

      <Tabs tabs={mainTabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Resources Tab */}
      {activeTab === "resources" && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <SearchBox
              value={resourceSearch}
              onChange={(e) => setResourceSearch(e.target.value)}
              placeholder="Search resources..."
              className="max-w-xs"
            />
            <Button
              onClick={() => {
                setEditingResource(null);
                setResourceModalOpen(true);
              }}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Add Resource
            </Button>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {typeFilters.map((t) => (
              <button
                key={t}
                onClick={() => setResourceTypeFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors cursor-pointer",
                  resourceTypeFilter === t
                    ? "bg-brand-500/15 text-brand-400"
                    : "text-muted hover:text-heading hover:bg-surface-raised"
                )}
              >
                {t === "all" ? "All" : t.toUpperCase()}
              </button>
            ))}
          </div>

          {resourcesLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
              title="No resources yet"
              description="Add your first study resource to get started."
              action={{
                children: "Add Resource",
                onClick: () => {
                  setEditingResource(null);
                  setResourceModalOpen(true);
                },
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onEdit={handleResourceEdit}
                    onDelete={handleResourceDelete}
                  />
                ))}
              </div>
              <LoadMoreButton hasMore={hasMoreResources} isLoading={isLoadingMoreResources} onLoadMore={loadMoreResources} />
            </>
          )}

          <ResourceModal
            isOpen={resourceModalOpen}
            onClose={() => {
              setResourceModalOpen(false);
              setEditingResource(null);
            }}
            resource={editingResource}
            onSave={handleResourceSave}
            isLoading={resourceMutating}
          />
        </div>
      )}

      {/* Flashcards Tab */}
      {activeTab === "flashcards" && (
        <div>
          {studyDeck ? (
            <FlashcardStudy
              deckId={studyDeck.id}
              deckName={studyDeck.name}
              onClose={handleCloseStudy}
            />
          ) : (
            <>
              <div className="flex items-center justify-end mb-4">
                <Button
                  onClick={() => {
                    setEditingDeck(null);
                    setDeckModalOpen(true);
                  }}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  }
                >
                  New Deck
                </Button>
              </div>

              {decksLoading ? (
                <div className="flex justify-center py-20">
                  <Spinner />
                </div>
              ) : decks.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                    </svg>
                  }
                  title="No flashcard decks"
                  description="Create your first deck to start studying."
                  action={{
                    children: "New Deck",
                    onClick: () => {
                      setEditingDeck(null);
                      setDeckModalOpen(true);
                    },
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {decks.map((deck) => (
                    <FlashcardDeckCard
                      key={deck.id}
                      deck={deck}
                      onClick={handleDeckEdit}
                      onStudy={handleStudy}
                      onEdit={handleDeckEdit}
                      onDelete={handleDeckDelete}
                    />
                  ))}
                </div>
              )}

              <FlashcardModal
                isOpen={deckModalOpen}
                onClose={() => {
                  setDeckModalOpen(false);
                  setEditingDeck(null);
                  setEditingDeckCards([]);
                }}
                deck={editingDeck}
                cards={deckCardsForEdit}
                onSaveDeck={handleDeckSave}
                onAddCard={handleAddCard}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
                isLoading={flashcardMutating}
              />
            </>
          )}
        </div>
      )}

      {/* Reading List Tab */}
      {activeTab === "reading" && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              {readingStatusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setReadingStatusFilter(f.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors cursor-pointer",
                    readingStatusFilter === f.key
                      ? "bg-brand-500/15 text-brand-400"
                      : "text-muted hover:text-heading hover:bg-surface-raised"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                setEditingReadingItem(null);
                setReadingModalOpen(true);
              }}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Add Item
            </Button>
          </div>

          {readingLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : readingItems.length === 0 ? (
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              }
              title="Nothing in your reading list"
              description="Add articles, books, or any reading material to track."
              action={{
                children: "Add Item",
                onClick: () => {
                  setEditingReadingItem(null);
                  setReadingModalOpen(true);
                },
              }}
            />
          ) : (
            <div className="card overflow-hidden">
              {readingItems.map((item) => (
                <ReadingListItem
                  key={item.id}
                  item={item}
                  onEdit={handleReadingEdit}
                  onDelete={handleReadingDelete}
                  onStatusChange={handleStatusChange}
                  canEdit={canEditReadingItem(item)}
                  canDelete={canDeleteReadingItem(item)}
                />
              ))}
            </div>
          )}

          <ReadingListModal
            isOpen={readingModalOpen}
            onClose={() => {
              setReadingModalOpen(false);
              setEditingReadingItem(null);
            }}
            item={editingReadingItem}
            onSave={handleReadingSave}
            isLoading={readingMutating}
            canDelete={editingReadingItem ? canDeleteReadingItem(editingReadingItem) : false}
          />
        </div>
      )}
    </div>
  );
}
