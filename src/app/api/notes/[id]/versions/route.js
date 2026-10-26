import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";
import { projectScopedAccessCondition } from "@/lib/projectAccess";

// Earlier versions of a note, newest first, for anyone who can open it.
// Restoring one is an ordinary save (PUT /api/notes/:id with snapshot: true),
// so the usual edit rules apply.
export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Note", { allowNull: false }).error) {
      return apiError("Note ID is invalid");
    }

    const result = await query(
      `SELECT v.id, v.revision, v.title, v.edited_at, v.created_at, editor.full_name AS edited_by_name
       FROM notes n
       JOIN note_versions v ON v.note_id = n.id
       LEFT JOIN users editor ON editor.id = v.edited_by
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2
       ORDER BY v.created_at DESC`,
      [request.user.id, id]
    );

    return apiResponse({ versions: result.rows });
  } catch (error) {
    console.error("Note versions list error:", error);
    return apiError("Internal server error", 500);
  }
});
