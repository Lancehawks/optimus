import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalEnum, optionalString, optionalUuid, requiredString } from "@/lib/apiValidation";
import { userCanAccessProject, userOwnsResource } from "@/lib/resourceAccess";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("project_id");
    const statusResult = optionalEnum(status || undefined, "Status", ["unread", "reading", "completed"]);
    const projectResult = optionalUuid(projectId || undefined, "Project");
    const validationError = firstValidationError(statusResult, projectResult);
    if (validationError) return apiError(validationError);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const conditions = ["rl.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`rl.status = $${paramIndex++}`);
      params.push(status);
    }
    if (projectId) {
      conditions.push(`rl.project_id = $${paramIndex++}`);
      params.push(projectId);
    }

    const result = await query(
      `SELECT rl.*, p.name AS project_name, p.color AS project_color
       FROM reading_list rl
       LEFT JOIN projects p ON p.id = rl.project_id AND (
         p.user_id = $1 OR EXISTS (
           SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
         )
       )
       WHERE ${conditions.join(" AND ")}
       ORDER BY rl.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return apiResponse({ items: result.rows });
  } catch (error) {
    console.error("Reading list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { title, url, resourceId, projectId } = body;
    const titleResult = requiredString(title, "Title", { max: 255 });
    const urlResult = optionalString(url, "URL", { max: 2048 });
    const resourceResult = optionalUuid(resourceId, "Resource");
    const projectResult = optionalUuid(projectId, "Project");
    const validationError = firstValidationError(titleResult, urlResult, resourceResult, projectResult);
    if (validationError) return apiError(validationError);
    let normalizedUrl = urlResult.value || null;
    if (normalizedUrl) {
      try { normalizedUrl = normalizePublicHttpUrl(normalizedUrl).toString(); }
      catch (error) { return apiError(error.message); }
    }

    const result = await transaction(async (client) => {
      if (!(await userOwnsResource(request.user.id, resourceResult.value, client))) {
        throw Object.assign(new Error("Resource not found"), { status: 400 });
      }
      if (!(await userCanAccessProject(request.user.id, projectResult.value, client))) {
        throw Object.assign(new Error("Project not found"), { status: 400 });
      }
      return client.query(
        `INSERT INTO reading_list (user_id, title, url, resource_id, project_id, status, progress)
         VALUES ($1, $2, $3, $4, $5, 'unread', 0)
         RETURNING *`,
        [request.user.id, titleResult.value, normalizedUrl, resourceResult.value || null, projectResult.value || null]
      );
    });

    return apiResponse({ item: result.rows[0] }, 201);
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
    console.error("Reading list create error:", error);
    return apiError("Internal server error", 500);
  }
});
