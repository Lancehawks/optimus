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
