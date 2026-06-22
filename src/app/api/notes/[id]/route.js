import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT n.*,
        nb.name AS notebook_name,
        p.name AS project_name,
        p.color AS project_color,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id AND nb.user_id = $1
       LEFT JOIN projects p ON p.id = n.project_id
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags tg ON tg.id = nt.tag_id
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2
       GROUP BY n.id, nb.name, p.name, p.color`,
      [request.user.id, id]
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
    const { title, content, notebookId, projectId, isPinned, tags } = body;

    // Verify personal ownership or shared project membership.
    const existing = await query(
      `SELECT n.*
       FROM notes n
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2`,
      [request.user.id, id]
    );
    if (existing.rows.length === 0) {
      return apiError("Note not found", 404);
    }
    const currentNote = existing.rows[0];

    const nextProjectId = projectId !== undefined ? projectId || null : currentNote.project_id;

    if (projectId !== undefined) {
      if (nextProjectId) {
        const project = await getProjectForMember(request.user.id, nextProjectId);
        if (!project) {
          return apiError("Project not found", 404);
        }
      } else if (currentNote.user_id !== request.user.id) {
        return apiError("Only the note creator can move it back to personal notes", 403);
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(content); }
    if (notebookId !== undefined || (projectId !== undefined && nextProjectId)) {
      fields.push(`notebook_id = $${paramIndex++}`);
      values.push(nextProjectId ? null : notebookId || null);
    }
    if (projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(projectId || null); }
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
        p.name AS project_name,
        p.color AS project_color,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id AND nb.user_id = $1
       LEFT JOIN projects p ON p.id = n.project_id
       LEFT JOIN note_tags nt ON nt.note_id = n.id
       LEFT JOIN tags tg ON tg.id = nt.tag_id
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2
       GROUP BY n.id, nb.name, p.name, p.color`,
      [request.user.id, id]
    );

    const updatedNote = result.rows[0];
    if (projectId !== undefined && currentNote.project_id && !nextProjectId) {
      await recordProjectActivity({
        projectId: currentNote.project_id,
        actorUserId: request.user.id,
        action: "moved_to_personal",
        entityType: "note",
        entityId: currentNote.id,
        entityTitle: currentNote.title,
      });
    } else if (nextProjectId) {
      await recordProjectActivity({
        projectId: nextProjectId,
        actorUserId: request.user.id,
        action: projectId !== undefined && currentNote.project_id !== nextProjectId
          ? "moved_to_project"
          : "updated",
        entityType: "note",
        entityId: updatedNote.id,
        entityTitle: updatedNote.title,
      });
    }

    return apiResponse({ note: updatedNote });
  } catch (error) {
    console.error("Note update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const existing = await query(
      `SELECT n.id, n.user_id, n.project_id, n.title
       FROM notes n
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Note not found", 404);
    }

    if (existing.rows[0].user_id !== request.user.id) {
      return apiError("Only the note creator can delete this note", 403);
    }

    const note = existing.rows[0];

    await query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (note.project_id) {
      await recordProjectActivity({
        projectId: note.project_id,
        actorUserId: request.user.id,
        action: "deleted",
        entityType: "note",
        entityId: note.id,
        entityTitle: note.title,
      });
    }

    return apiResponse({ message: "Note deleted" });
  } catch (error) {
    console.error("Note delete error:", error);
    return apiError("Internal server error", 500);
  }
});
