import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const isTemplate = searchParams.get("is_template");
    const category = searchParams.get("category");
    const projectId = searchParams.get("project_id");
    const pinnedOnly = searchParams.get("pinned");

    const conditions = ["w.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (isTemplate === "true") {
      conditions.push("w.is_template = true");
    } else if (isTemplate === "false") {
      conditions.push("w.is_template = false");
    }

    if (pinnedOnly === "true") {
      conditions.push("w.is_pinned = true");
    }

    if (category) {
      conditions.push(`w.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (projectId) {
      conditions.push(`w.project_id = $${paramIndex}`);
      params.push(projectId);
      paramIndex++;
    }

    if (search) {
      conditions.push(`w.title ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT w.id, w.title, w.thumbnail_url, w.is_template, w.is_pinned,
              w.category, w.project_id, w.created_at, w.updated_at,
              p.name AS project_name
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY w.is_pinned DESC, w.updated_at DESC`,
      params
    );

    return apiResponse({ whiteboards: result.rows });
  } catch (error) {
    console.error("Whiteboards list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { title, excalidrawData, isTemplate, category, projectId } = body;

    if (!title) {
      return apiError("Title is required");
    }

    const result = await query(
      `INSERT INTO whiteboards (user_id, title, excalidraw_data, is_template, category, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.user.id,
        title,
        JSON.stringify(excalidrawData || {}),
        isTemplate || false,
        category || null,
        projectId || null,
      ]
    );

    return apiResponse({ whiteboard: result.rows[0] }, 201);
  } catch (error) {
    console.error("Whiteboard create error:", error);
    return apiError("Internal server error", 500);
  }
});
