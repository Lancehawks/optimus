import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";
import { projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id, versionId } = await params;
    if (optionalUuid(id, "Note", { allowNull: false }).error || optionalUuid(versionId, "Version", { allowNull: false }).error) {
      return apiError("Version not found", 404);
    }

    const result = await query(
      `SELECT v.id, v.revision, v.title, v.content, v.content_blocks, v.edited_at, v.created_at,
              editor.full_name AS edited_by_name
       FROM notes n
       JOIN note_versions v ON v.note_id = n.id
       LEFT JOIN users editor ON editor.id = v.edited_by
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2 AND v.id = $3`,
      [request.user.id, id, versionId]
    );
    if (!result.rows[0]) return apiError("Version not found", 404);

    return apiResponse({ version: result.rows[0] });
  } catch (error) {
    console.error("Note version get error:", error);
    return apiError("Internal server error", 500);
  }
});
