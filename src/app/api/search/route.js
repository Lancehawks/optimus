import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { projectScopedAccessCondition } from "@/lib/projectAccess";
import { checkRateLimits } from "@/lib/rateLimit";

const PER_TYPE_LIMIT = 5;

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 150) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function searchHref(path, params) {
  const qs = new URLSearchParams(params);
  return `${path}?${qs.toString()}`;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = clean(searchParams.get("q")).slice(0, 120);

    if (q.length < 2) {
      return apiResponse({ results: [] });
    }

    const rateLimit = await checkRateLimits(request, [{
      scope: "search:user",
      identifier: request.user.id,
      limit: 120,
      windowMs: 60 * 1000,
    }]);
    if (!rateLimit.allowed) {
      return apiError("Search is temporarily rate limited. Please retry shortly.", 429);
    }

    const pattern = `%${escapeLike(q)}%`;

    const [tasks, notes, projects, bookmarks, resources] = await Promise.all([
      query(
        `SELECT
           t.id,
           t.title,
           t.description,
           t.status,
           t.priority,
           t.due_date,
           t.updated_at,
           t.created_at,
           p.name AS project_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE ${projectScopedAccessCondition("t")}
           AND t.parent_task_id IS NULL
           AND t.is_archived = false
           AND (t.title ILIKE $2 ESCAPE '\\' OR t.description ILIKE $2 ESCAPE '\\' OR p.name ILIKE $2 ESCAPE '\\')
         ORDER BY
           CASE WHEN t.title ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
           COALESCE(t.updated_at, t.created_at) DESC
         LIMIT $3`,
        [request.user.id, pattern, PER_TYPE_LIMIT]
      ),
      query(
        `SELECT
           n.id,
           n.title,
           n.content,
           n.project_id,
           n.updated_at,
           n.created_at,
           nb.name AS notebook_name,
           p.name AS project_name
         FROM notes n
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id AND nb.user_id = $1
         LEFT JOIN projects p ON p.id = n.project_id
         WHERE ${projectScopedAccessCondition("n")}
           AND (n.title ILIKE $2 ESCAPE '\\' OR n.content ILIKE $2 ESCAPE '\\' OR nb.name ILIKE $2 ESCAPE '\\' OR p.name ILIKE $2 ESCAPE '\\')
         ORDER BY
           CASE WHEN n.title ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
           COALESCE(n.updated_at, n.created_at) DESC
         LIMIT $3`,
        [request.user.id, pattern, PER_TYPE_LIMIT]
      ),
      query(
        `SELECT
           p.id,
           p.name,
           p.description,
           p.status,
           p.type,
           p.color,
           p.created_at
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = $1
           AND p.is_archived = false
           AND (p.name ILIKE $2 ESCAPE '\\' OR p.description ILIKE $2 ESCAPE '\\')
         ORDER BY
           CASE WHEN p.name ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
           p.created_at DESC
         LIMIT $3`,
        [request.user.id, pattern, PER_TYPE_LIMIT]
      ),
      query(
        `SELECT
           b.id,
           b.title,
           b.url,
           b.description,
           b.created_at,
           bc.name AS collection_name
         FROM bookmarks b
         LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id
         WHERE b.user_id = $1
           AND (b.title ILIKE $2 ESCAPE '\\' OR b.url ILIKE $2 ESCAPE '\\' OR b.description ILIKE $2 ESCAPE '\\' OR bc.name ILIKE $2 ESCAPE '\\')
         ORDER BY
           CASE WHEN b.title ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
           b.created_at DESC
         LIMIT $3`,
        [request.user.id, pattern, PER_TYPE_LIMIT]
      ),
      query(
        `SELECT
           r.id,
           r.title,
           r.type,
           r.notes,
           r.file_url,
           r.created_at
         FROM resources r
         WHERE r.user_id = $1
           AND (r.title ILIKE $2 ESCAPE '\\' OR r.notes ILIKE $2 ESCAPE '\\' OR r.file_url ILIKE $2 ESCAPE '\\')
         ORDER BY
           CASE WHEN r.title ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
           r.created_at DESC
         LIMIT $3`,
        [request.user.id, pattern, PER_TYPE_LIMIT]
      ),
    ]);

    const results = [
      ...tasks.rows.map((task) => ({
        id: task.id,
        type: "task",
        label: "Task",
        title: clean(task.title) || "Untitled task",
        description: truncate(task.description || task.project_name || task.status),
        meta: [task.status?.replaceAll("_", " "), task.priority, task.project_name].filter(Boolean).join(" · "),
        href: searchHref("/tasks", { task_id: task.id }),
        timestamp: task.updated_at || task.created_at,
      })),
      ...notes.rows.map((note) => ({
        id: note.id,
        type: "note",
        label: "Note",
        title: clean(note.title) || "Untitled note",
        description: truncate(note.content || note.notebook_name || note.project_name),
        meta: [note.project_name || note.notebook_name, "note"].filter(Boolean).join(" · "),
        href: searchHref("/notes", {
          ...(note.project_id ? { project_id: note.project_id } : {}),
          note_id: note.id,
        }),
        timestamp: note.updated_at || note.created_at,
      })),
      ...projects.rows.map((project) => ({
        id: project.id,
        type: "project",
        label: "Project",
        title: clean(project.name) || "Untitled project",
        description: truncate(project.description || project.type || project.status),
        meta: [project.status, project.type].filter(Boolean).join(" · "),
        href: searchHref("/projects", { project_id: project.id }),
        timestamp: project.created_at,
      })),
      ...bookmarks.rows.map((bookmark) => ({
        id: bookmark.id,
        type: "bookmark",
        label: "Saved link",
        title: clean(bookmark.title) || bookmark.url,
        description: truncate(bookmark.description || bookmark.url || bookmark.collection_name),
        meta: bookmark.collection_name || "saved link",
        href: searchHref("/bookmarks", { search: bookmark.title || bookmark.url || q }),
        externalUrl: bookmark.url,
        timestamp: bookmark.created_at,
      })),
      ...resources.rows.map((resource) => ({
        id: resource.id,
        type: "resource",
        label: "Resource",
        title: clean(resource.title) || "Untitled resource",
        description: truncate(resource.notes || resource.file_url || resource.type),
        meta: resource.type?.toUpperCase?.() || "resource",
        href: searchHref("/resources", { search: resource.title || q }),
        timestamp: resource.created_at,
      })),
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return apiResponse({ results });
  } catch (error) {
    console.error("Global search error:", error);
    return apiError("Internal server error", 500);
  }
});
