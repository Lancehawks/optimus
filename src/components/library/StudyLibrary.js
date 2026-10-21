"use client";

import { useEffect, useState } from "react";
import { BookOpen, FileText, Layers, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, SearchBox, Tabs, useToast } from "@/components/ui";
import { useResources, useResourceMutations } from "@/hooks/useResources";
import { useFlashcardDecks, useDeckCards, useFlashcardMutations } from "@/hooks/useFlashcards";
import { useReadingList, useReadingListMutations } from "@/hooks/useReadingList";
import ResourceCard from "@/components/resources/ResourceCard";
import ResourceModal from "@/components/resources/ResourceModal";
import FlashcardDeckCard from "@/components/resources/FlashcardDeckCard";
import FlashcardModal from "@/components/resources/FlashcardModal";
import FlashcardStudy from "@/components/resources/FlashcardStudy";
import ReadingListItem from "@/components/resources/ReadingListItem";
import ReadingListModal from "@/components/resources/ReadingListModal";
import LoadMoreButton from "@/components/ui/LoadMoreButton";
import { useAuth } from "@/context/AuthContext";

const typeFilters = ["all", "pdf", "doc", "image", "link", "other"];

const readingStatusFilters = [
  { key: "", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "reading", label: "Reading" },
  { key: "completed", label: "Completed" },
];

export default function StudyLibrary({ section = "resources", initialSearch = "" }) {
  const querySearch = initialSearch;
  const { addToast } = useToast();
  const { user } = useAuth();
  const activeTab = section;

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
  const { resources, error: resourcesError, pagination: resourcePagination, isLoading: resourcesLoading, refetch: refetchResources, hasMore: hasMoreResources, loadMore: loadMoreResources, isLoadingMore: isLoadingMoreResources } = useResources({
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
  }, [querySearch]);

  // Flashcards hooks
  const { decks, error: decksError, isLoading: decksLoading, refetch: refetchDecks } = useFlashcardDecks();
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
  const { items: readingItems, error: readingError, isLoading: readingLoading, refetch: refetchReading } = useReadingList({
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
        addToast({ message: "Resource deleted", type: "success" });
        return;
      }
      if (data.id) {
        await updateResource(data.id, data);
        addToast({ message: "Resource updated", type: "success" });
      } else {
        await createResource(data);
        addToast({ message: "Resource created", type: "success" });
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleResourceEdit = (resource) => {
    setEditingResource(resource);
    setResourceModalOpen(true);
  };

  const handleResourceDelete = async (resource) => {
    try {
      await deleteResource(resource.id);
      addToast({ message: "Resource deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
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
        addToast({ message: "Deck updated", type: "success" });
      } else {
        const newDeck = await createDeck({ name: data.name, description: data.description });
        setEditingDeck(newDeck);
        addToast({ message: "Deck created", type: "success" });
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeckDelete = async (deck) => {
    try {
      await deleteDeck(deck.id);
      addToast({ message: "Deck deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleAddCard = async (deckId, data) => {
    try {
      await addCard(deckId, data);
      addToast({ message: "Card added", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleUpdateCard = async (deckId, cardId, data) => {
    try {
      await updateCard(deckId, cardId, data);
      addToast({ message: "Card updated", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteCard = async (deckId, cardId) => {
    try {
      await deleteCard(deckId, cardId);
      addToast({ message: "Card deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
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
        addToast({ message: "Item deleted", type: "success" });
        return;
      }
      if (data.id) {
        if (!canEditReadingItem(editingReadingItem)) return;
        await updateItem(data.id, data);
        addToast({ message: "Item updated", type: "success" });
      } else {
        await createItem(data);
        addToast({ message: "Item added", type: "success" });
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
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
      addToast({ message: "Item deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
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
      addToast({ message: error.message, type: "error" });
    }
  };

  const openNewResource = () => {
    setEditingResource(null);
    setResourceModalOpen(true);
  };
  const openNewDeck = () => {
    setEditingDeck(null);
    setDeckModalOpen(true);
  };
  const openNewReading = () => {
    setEditingReadingItem(null);
    setReadingModalOpen(true);
  };

  const skeletonRows = (
    <div className="card divide-y divide-border">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-3.5 flex-1" />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {activeTab === "resources" && (
        <div>
          {resourcesError && <ErrorState compact className="mb-4" title="Resources couldn't be loaded" onRetry={refetchResources} />}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <SearchBox value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search resources" />
            </div>
            <Tabs
              size="sm"
              tabs={typeFilters.map((t) => ({ key: t, label: t === "all" ? "All" : t.toUpperCase() }))}
              activeTab={resourceTypeFilter}
              onChange={setResourceTypeFilter}
            />
            <Button className="ml-auto" onClick={openNewResource} leftIcon={<Plus />}>Add resource</Button>
          </div>

          {resourcesLoading ? skeletonRows : resources.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<FileText />}
                title="No resources yet"
                description="Keep reference material in one place: documents, PDFs, images and links."
                action={{ children: "Add resource", onClick: openNewResource, leftIcon: <Plus /> }}
              />
            </div>
          ) : (
            <>
              <div className="card divide-y divide-border overflow-hidden">
                {resources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} onEdit={handleResourceEdit} onDelete={handleResourceDelete} />
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

      {activeTab === "flashcards" && (
        <div>
          {decksError && <ErrorState compact className="mb-4" title="Flashcard decks couldn't be loaded" onRetry={refetchDecks} />}
          {studyDeck ? (
            <FlashcardStudy deckId={studyDeck.id} deckName={studyDeck.name} onClose={handleCloseStudy} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs text-muted">{decks.length} deck{decks.length === 1 ? "" : "s"}</span>
                <Button onClick={openNewDeck} leftIcon={<Plus />}>New deck</Button>
              </div>

              {decksLoading ? skeletonRows : decks.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Layers />}
                    title="No decks yet"
                    description="Turn what you're learning into cards and review them on a spaced schedule."
                    action={{ children: "New deck", onClick: openNewDeck, leftIcon: <Plus /> }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      {activeTab === "reading" && (
        <div>
          {readingError && <ErrorState compact className="mb-4" title="Reading list couldn't be loaded" onRetry={refetchReading} />}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Tabs size="sm" tabs={readingStatusFilters} activeTab={readingStatusFilter} onChange={setReadingStatusFilter} />
            <Button className="ml-auto" onClick={openNewReading} leftIcon={<Plus />}>Add to list</Button>
          </div>

          {readingLoading ? skeletonRows : readingItems.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<BookOpen />}
                title="Nothing to read"
                description="Queue up books and articles, and track how far through each one you are."
                action={{ children: "Add to list", onClick: openNewReading, leftIcon: <Plus /> }}
              />
            </div>
          ) : (
            <div className="card divide-y divide-border overflow-hidden">
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
