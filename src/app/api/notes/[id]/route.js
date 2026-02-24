import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT n.*,
        nb.name AS notebook_name,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags tg ON tg.id = nt.tag_id
       WHERE n.id = $1 AND n.user_id = $2
       GROUP BY n.id, nb.name`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Note not found", 404);
    }

    return apiResponse({ note: result.rows[0] });
  } catch (error) {
    console.error("Note get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, notebookId, isPinned, tags } = body;

    // Verify ownership
    const existing = await query(
      "SELECT id FROM notes WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Note not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(content); }
    if (notebookId !== undefined) { fields.push(`notebook_id = $${paramIndex++}`); values.push(notebookId); }
    if (isPinned !== undefined) { fields.push(`is_pinned = $${paramIndex++}`); values.push(isPinned); }

    if (fields.length > 0) {
      values.push(id);
      await query(
        `UPDATE notes SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Update tags
    if (tags !== undefined) {
      await query("DELETE FROM note_tags WHERE note_id = $1", [id]);
      for (const tagId of tags) {
        await query(
          "INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, tagId]
        );
      }
    }

    // Return updated note
    const result = await query(
      `SELECT n.*,
        nb.name AS notebook_name,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags tg ON tg.id = nt.tag_id
       WHERE n.id = $1
       GROUP BY n.id, nb.name`,
      [id]
    );

    return apiResponse({ note: result.rows[0] });
  } catch (error) {
    console.error("Note update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Note not found", 404);
    }

    return apiResponse({ message: "Note deleted" });
  } catch (error) {
    console.error("Note delete error:", error);
    return apiError("Internal server error", 500);
  }
});
