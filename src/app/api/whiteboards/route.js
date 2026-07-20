import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalBoolean, optionalString, optionalUuid, requiredString } from "@/lib/apiValidation";
import { userCanAccessProject } from "@/lib/resourceAccess";
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const isTemplate = searchParams.get("is_template");
    const category = searchParams.get("category");
    const projectId = searchParams.get("project_id");
    const pinnedOnly = searchParams.get("pinned");
    const projectValidation = optionalUuid(projectId || undefined, "Project");
    if (projectValidation.error) return apiError(projectValidation.error);
    if (search && search.length > 200) return apiError("Search must be 200 characters or less");
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"), ["isPinned", "updatedAt", "id"]);
    if (cursor.error) return apiError(cursor.error);

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

    const cursorCondition = cursor.value
      ? `WHERE (page_source.is_pinned < $${paramIndex}::boolean OR (page_source.is_pinned = $${paramIndex}::boolean AND (page_source.updated_at, page_source.id) < ($${paramIndex + 1}::timestamptz, $${paramIndex + 2}::uuid)))`
      : "";
    if (cursor.value) {
      params.push(cursor.value.isPinned, cursor.value.updatedAt, cursor.value.id);
      paramIndex += 3;
    }

    const result = await query(
      `WITH filtered_whiteboards AS (
         SELECT w.id, w.title, w.thumbnail_url, w.is_template, w.is_pinned,
                w.category, w.project_id, w.created_at, w.updated_at,
                p.name AS project_name
         FROM whiteboards w
         LEFT JOIN projects p ON w.project_id = p.id AND (
           p.user_id = $1 OR EXISTS (
             SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
           )
         )
         WHERE ${conditions.join(" AND ")}
       )
       SELECT page_source.*,
              (SELECT COUNT(*)::int FROM filtered_whiteboards) AS __filtered_count,
              (SELECT COUNT(*)::int FROM whiteboards total_w WHERE total_w.user_id = $1) AS __total_count
       FROM filtered_whiteboards page_source
       ${cursorCondition}
       ORDER BY page_source.is_pinned DESC, page_source.updated_at DESC, page_source.id DESC
       LIMIT $${paramIndex}`,
      [...params, limit + 1]
    );

    const page = finishCursorPage(result.rows, limit, (row) => ({ isPinned: row.is_pinned, updatedAt: row.updated_at, id: row.id }));
    const whiteboards = page.items.map(({ __filtered_count, __total_count, ...whiteboard }) => whiteboard);
    return apiResponse({ whiteboards, pagination: { ...page.pagination, totalCount: result.rows[0]?.__total_count || 0, filteredCount: result.rows[0]?.__filtered_count || 0 } });
  } catch (error) {
    console.error("Whiteboards list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { title, excalidrawData, isTemplate, category, projectId } = body;
    const titleResult = requiredString(title, "Title", { max: 255 });
    const templateResult = optionalBoolean(isTemplate, "Template");
    const categoryResult = optionalString(category, "Category", { max: 100 });
    const projectResult = optionalUuid(projectId, "Project");
    const validationError = firstValidationError(titleResult, templateResult, categoryResult, projectResult);
    if (validationError) return apiError(validationError);
    const serializedData = JSON.stringify(excalidrawData || {});
    if (serializedData.length > 2_000_000) return apiError("Whiteboard data is too large", 413);
    if (!(await userCanAccessProject(request.user.id, projectResult.value))) {
      return apiError("Project not found", 400);
    }

    const result = await query(
      `INSERT INTO whiteboards (user_id, title, excalidraw_data, is_template, category, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.user.id,
        titleResult.value,
        serializedData,
        templateResult.value || false,
        categoryResult.value || null,
        projectResult.value || null,
      ]
    );

    return apiResponse({ whiteboard: result.rows[0] }, 201);
  } catch (error) {
    console.error("Whiteboard create error:", error);
    return apiError("Internal server error", 500);
  }
});
