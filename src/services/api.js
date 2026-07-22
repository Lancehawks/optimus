const responseCache = new Map();
const RESPONSE_CACHE_MS = 10_000;
const RESPONSE_CACHE_MAX_ENTRIES = 100;
let responseCacheVersion = 0;

export const DATA_CHANGED_EVENT = "optimus-data-changed";

async function fetchAPI(endpoint, options = {}) {
  const { body, ...rest } = options;
  const method = String(rest.method || "GET").toUpperCase();
  const requestCacheVersion = responseCacheVersion;
  const cached = method === "GET" ? responseCache.get(endpoint) : null;
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) responseCache.delete(endpoint);

  const config = {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...rest,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${endpoint}`, config);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong");
    error.status = response.status;
    error.data = data;
    if (response.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent("optimus-session-expired"));
    }
    throw error;
  }

  if (method === "GET" && requestCacheVersion === responseCacheVersion) {
    if (responseCache.size >= RESPONSE_CACHE_MAX_ENTRIES) {
      responseCache.delete(responseCache.keys().next().value);
    }
    responseCache.set(endpoint, { data, expiresAt: Date.now() + RESPONSE_CACHE_MS });
  } else if (method !== "GET") {
    responseCacheVersion += 1;
    responseCache.clear();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, {
        detail: { endpoint, method },
      }));
    }
  }

  return data;
}

export function isUnauthorizedError(error) {
  return error?.status === 401 || error?.message === "Unauthorized";
}

// ── Auth ──────────────────────────────────────────────
export const authService = {
  signup: (data) => fetchAPI("/auth/signup", { method: "POST", body: data }),
  login: (data) => fetchAPI("/auth/login", { method: "POST", body: data }),
  logout: () => fetchAPI("/auth/logout", { method: "POST" }),
  me: () => fetchAPI("/auth/me"),
  updateProfile: (data) => fetchAPI("/auth/profile", { method: "PUT", body: data }),
  getSessions: () => fetchAPI("/auth/sessions"),
  revokeSession: (id) => fetchAPI(`/auth/sessions/${id}`, { method: "DELETE" }),
  forgotPassword: (email) => fetchAPI("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (data) => fetchAPI("/auth/reset-password", { method: "POST", body: data }),
};

// ── Tasks ─────────────────────────────────────────────
export const taskService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/tasks${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/tasks/${id}`, options),
  create: (data) => fetchAPI("/tasks", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/tasks/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/tasks/${id}`, { method: "DELETE" }),
  addSubtask: (taskId, data) => fetchAPI(`/tasks/${taskId}/subtasks`, { method: "POST", body: data }),
  updateSubtask: (taskId, subtaskId, data) => fetchAPI(`/tasks/${taskId}/subtasks`, { method: "PUT", body: { subtaskId, ...data } }),
  deleteSubtask: (taskId, subtaskId) => fetchAPI(`/tasks/${taskId}/subtasks`, { method: "DELETE", body: { subtaskId } }),
  bulk: (data) => fetchAPI("/tasks/bulk", { method: "POST", body: data }),
  getDependencies: (taskId) => fetchAPI(`/tasks/${taskId}/dependencies`),
  updateDependencies: (taskId, dependencies) => fetchAPI(`/tasks/${taskId}/dependencies`, { method: "PUT", body: { dependencies } }),
};

// ── Tags ──────────────────────────────────────────────
export const tagService = {
  list: () => fetchAPI("/tags"),
  create: (data) => fetchAPI("/tags", { method: "POST", body: data }),
};

// ── Notes ─────────────────────────────────────────────
export const noteService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/notes${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/notes/${id}`, options),
  create: (data) => fetchAPI("/notes", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/notes/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/notes/${id}`, { method: "DELETE" }),
};

// ── Notebooks ─────────────────────────────────────────
export const notebookService = {
  list: () => fetchAPI("/notebooks"),
  create: (data) => fetchAPI("/notebooks", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/notebooks/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/notebooks/${id}`, { method: "DELETE" }),
};

// ── Projects ─────────────────────────────────────────
export const projectService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/projects${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/projects/${id}`, options),
  create: (data) => fetchAPI("/projects", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/projects/${id}`, { method: "PUT", body: data }),
  delete: (id, { deleteTasks } = {}) => fetchAPI(`/projects/${id}${deleteTasks ? "?deleteTasks=true" : ""}`, { method: "DELETE" }),
  listMembers: (projectId) => fetchAPI(`/projects/${projectId}/members`),
  addMember: (projectId, email) => fetchAPI(`/projects/${projectId}/members`, { method: "POST", body: { email } }),
  removeMember: (projectId, userId) => fetchAPI(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  listActivity: (projectId) => fetchAPI(`/projects/${projectId}/activity`),
  listMilestones: (projectId) => fetchAPI(`/projects/${projectId}/milestones`),
  addMilestone: (projectId, data) => fetchAPI(`/projects/${projectId}/milestones`, { method: "POST", body: data }),
  updateMilestone: (projectId, milestoneId, data) => fetchAPI(`/projects/${projectId}/milestones/${milestoneId}`, { method: "PUT", body: data }),
  deleteMilestone: (projectId, milestoneId) => fetchAPI(`/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" }),
};

export const notificationService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/notifications${qs ? `?${qs}` : ""}`);
  },
  markRead: (id) => fetchAPI(`/notifications/${id}`, { method: "PATCH" }),
  markManyRead: (ids) => fetchAPI("/notifications", { method: "PATCH", body: { ids } }),
  syncLive: () => fetchAPI("/notifications/sync", { method: "POST" }),
  getPreferences: () => fetchAPI("/notifications/preferences"),
  updatePreferences: (preferences) =>
    fetchAPI("/notifications/preferences", { method: "PUT", body: { preferences } }),
  respondToProjectInvitation: (id, action) =>
    fetchAPI(`/project-invitations/${id}`, { method: "PATCH", body: { action } }),
  respondToEventCompletion: (id, status) =>
    fetchAPI(`/notifications/${id}/event-completion`, { method: "PATCH", body: { status } }),
};

// ── Bookmarks ────────────────────────────────────────
export const bookmarkService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/bookmarks${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/bookmarks/${id}`, options),
  create: (data) => fetchAPI("/bookmarks", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/bookmarks/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/bookmarks/${id}`, { method: "DELETE" }),
};

// ── Bookmark Collections ─────────────────────────────
export const bookmarkCollectionService = {
  list: () => fetchAPI("/bookmark-collections"),
  create: (data) => fetchAPI("/bookmark-collections", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/bookmark-collections/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/bookmark-collections/${id}`, { method: "DELETE" }),
};

// ── Whiteboards ──────────────────────────────────────
export const whiteboardService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/whiteboards${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/whiteboards/${id}`, options),
  create: (data) => fetchAPI("/whiteboards", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/whiteboards/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/whiteboards/${id}`, { method: "DELETE" }),
  duplicate: (id) => fetchAPI(`/whiteboards/${id}/duplicate`, { method: "POST" }),
};

// ── Resources ───────────────────────────────────────
export const resourceService = {
  list: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/resources${qs ? `?${qs}` : ""}`, options);
  },
  get: (id, options = {}) => fetchAPI(`/resources/${id}`, options),
  create: (data) => fetchAPI("/resources", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/resources/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/resources/${id}`, { method: "DELETE" }),
};

// ── Flashcard Decks ─────────────────────────────────
export const flashcardDeckService = {
  list: () => fetchAPI("/flashcard-decks"),
  get: (id) => fetchAPI(`/flashcard-decks/${id}`),
  create: (data) => fetchAPI("/flashcard-decks", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/flashcard-decks/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/flashcard-decks/${id}`, { method: "DELETE" }),
  getCards: (deckId) => fetchAPI(`/flashcard-decks/${deckId}/cards`),
  addCard: (deckId, data) => fetchAPI(`/flashcard-decks/${deckId}/cards`, { method: "POST", body: data }),
  updateCard: (deckId, cardId, data) => fetchAPI(`/flashcard-decks/${deckId}/cards/${cardId}`, { method: "PUT", body: data }),
  deleteCard: (deckId, cardId) => fetchAPI(`/flashcard-decks/${deckId}/cards/${cardId}`, { method: "DELETE" }),
  submitReview: (deckId, data) => fetchAPI(`/flashcard-decks/${deckId}/review`, { method: "POST", body: data }),
};

// ── Calendars ───────────────────────────────────────
export const calendarService = {
  list: () => fetchAPI("/calendars"),
  create: (data) => fetchAPI("/calendars", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/calendars/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/calendars/${id}`, { method: "DELETE" }),
};

// ── Events ──────────────────────────────────────────
export const eventService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/events${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/events/${id}`),
  create: (data) => fetchAPI("/events", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/events/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/events/${id}`, { method: "DELETE" }),
};

// ── Google Calendar ─────────────────────────────────
export const googleService = {
  getAuthUrl: () => fetchAPI("/google/auth"),
  getStatus: () => fetchAPI("/google/status"),
  disconnect: () => fetchAPI("/google/disconnect", { method: "POST" }),
  sync: () => fetchAPI("/google/sync", { method: "POST" }),
};

// ── Reading List ────────────────────────────────────
export const readingListService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/reading-list${qs ? `?${qs}` : ""}`);
  },
  create: (data) => fetchAPI("/reading-list", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/reading-list/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/reading-list/${id}`, { method: "DELETE" }),
};

// ── Dashboard ────────────────────────────────────────
export const dashboardService = {
  getOverview: (params = {}, options = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/dashboard/overview${qs ? `?${qs}` : ""}`, options);
  },
  getStats: () => fetchAPI("/dashboard/stats"),
  getIndicators: () => fetchAPI("/dashboard/indicators"),
};

export const searchService = {
  global: (query, options = {}) => fetchAPI(`/search?q=${encodeURIComponent(query)}`, options),
};

// ── Daily Checklist ─────────────────────────────────
export const checklistService = {
  getSections: () => fetchAPI("/checklist/sections"),
  createSection: (data) => fetchAPI("/checklist/sections", { method: "POST", body: data }),
  updateSection: (id, data) => fetchAPI(`/checklist/sections/${id}`, { method: "PUT", body: data }),
  deleteSection: (id) => fetchAPI(`/checklist/sections/${id}`, { method: "DELETE" }),
  addItem: (sectionId, data) => fetchAPI(`/checklist/sections/${sectionId}/items`, { method: "POST", body: data }),
  updateItem: (id, data) => fetchAPI(`/checklist/items/${id}`, { method: "PUT", body: data }),
  deleteItem: (id) => fetchAPI(`/checklist/items/${id}`, { method: "DELETE" }),
  toggleLog: (data) => fetchAPI("/checklist/log", { method: "POST", body: data }),
  getHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/checklist/history?${qs}`);
  },
};

// ── Day Planner ─────────────────────────────────────
export const dayPlanService = {
  getBlocks: () => fetchAPI("/day-plan/blocks"),
  createBlock: (data) => fetchAPI("/day-plan/blocks", { method: "POST", body: data }),
  updateBlock: (id, data) => fetchAPI(`/day-plan/blocks/${id}`, { method: "PUT", body: data }),
  deleteBlock: (id) => fetchAPI(`/day-plan/blocks/${id}`, { method: "DELETE" }),
  reorderBlocks: (orderedIds) => fetchAPI("/day-plan/blocks/reorder", { method: "POST", body: { orderedIds } }),
  getStatus: (date) => fetchAPI(`/day-plan/status?date=${date}`),
  apply: (data) => fetchAPI("/day-plan/apply", { method: "POST", body: data }),
};
