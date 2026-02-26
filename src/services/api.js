async function fetchAPI(endpoint, options = {}) {
  const { body, ...rest } = options;

  const config = {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...rest,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
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
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/tasks/${id}`),
  create: (data) => fetchAPI("/tasks", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/tasks/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/tasks/${id}`, { method: "DELETE" }),
  addSubtask: (taskId, data) => fetchAPI(`/tasks/${taskId}/subtasks`, { method: "POST", body: data }),
  updateSubtask: (taskId, subtaskId, data) => fetchAPI(`/tasks/${taskId}/subtasks`, { method: "PUT", body: { subtaskId, ...data } }),
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
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/notes${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/notes/${id}`),
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
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/projects${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/projects/${id}`),
  create: (data) => fetchAPI("/projects", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/projects/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/projects/${id}`, { method: "DELETE" }),
  listMilestones: (projectId) => fetchAPI(`/projects/${projectId}/milestones`),
  addMilestone: (projectId, data) => fetchAPI(`/projects/${projectId}/milestones`, { method: "POST", body: data }),
  updateMilestone: (projectId, milestoneId, data) => fetchAPI(`/projects/${projectId}/milestones/${milestoneId}`, { method: "PUT", body: data }),
  deleteMilestone: (projectId, milestoneId) => fetchAPI(`/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" }),
};

// ── Habits ──────────────────────────────────────────
export const habitService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/habits${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/habits/${id}`),
  create: (data) => fetchAPI("/habits", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/habits/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/habits/${id}`, { method: "DELETE" }),
  toggleLog: (id, data) => fetchAPI(`/habits/${id}/log`, { method: "POST", body: data }),
  getStats: (id) => fetchAPI(`/habits/${id}/stats`),
};

// ── Bookmarks ────────────────────────────────────────
export const bookmarkService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/bookmarks${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/bookmarks/${id}`),
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
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/whiteboards${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/whiteboards/${id}`),
  create: (data) => fetchAPI("/whiteboards", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/whiteboards/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/whiteboards/${id}`, { method: "DELETE" }),
  duplicate: (id) => fetchAPI(`/whiteboards/${id}/duplicate`, { method: "POST" }),
};

// ── Resources ───────────────────────────────────────
export const resourceService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/resources${qs ? `?${qs}` : ""}`);
  },
  get: (id) => fetchAPI(`/resources/${id}`),
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

// ── AI Chats ──────────────────────────────────────────
export const aiChatService = {
  list: () => fetchAPI("/ai-chats"),
  get: (id) => fetchAPI(`/ai-chats/${id}`),
  create: (data) => fetchAPI("/ai-chats", { method: "POST", body: data }),
  update: (id, data) => fetchAPI(`/ai-chats/${id}`, { method: "PUT", body: data }),
  delete: (id) => fetchAPI(`/ai-chats/${id}`, { method: "DELETE" }),
  addMessage: (id, data) => fetchAPI(`/ai-chats/${id}/messages`, { method: "POST", body: data }),
};
