import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, isProjectOwner, projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";
import {
  firstValidationError,
  optionalBoolean,
  optionalRequiredString,
  optionalString,
  optionalUuid,
  parseJsonObject,
  uuidArray,
} from "@/lib/apiValidation";
import { userOwnsAllTags, userOwnsOrNoteUsesAllTags } from "@/lib/tagAccess";
import { userOwnsNotebook } from "@/lib/notebookAccess";

function validateNoteUpdateBody(body) {
  const title = optionalRequiredString(body.title, "Title", { max: 255 });
  const content = optionalString(body.content, "Content", {
    max: 500000,
    emptyToNull: false,
    trim: false,
  });
  const notebookId = optionalUuid(body.notebookId, "Notebook");
  const projectId = optionalUuid(body.projectId, "Project");
  const isPinned = optionalBoolean(body.isPinned, "Pinned");
  const tags = uuidArray(body.tags, "Tags", { max: 100 });

  const error = firstValidationError(title, content, notebookId, projectId, isPinned, tags);
  if (error) return { error };

  const value = {};
  if (title.provided) value.title = title.value;
  if (content.provided) value.content = content.value;
  if (notebookId.provided) value.notebookId = notebookId.value;
  if (projectId.provided) value.projectId = projectId.value;
  if (isPinned.provided) value.isPinned = isPinned.value;
  if (tags.provided) value.tags = tags.value;

  return { value };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Note", { allowNull: false }).error) {
      return apiError("Note ID is invalid");
    }

    const result = await query(
      `SELECT n.*,
        nb.name AS notebook_name,
        p.name AS project_name,
        p.color AS project_color,
        ${projectOwnerCondition("n")} AS is_project_owner,
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
    if (optionalUuid(id, "Note", { allowNull: false }).error) {
      return apiError("Note ID is invalid");
    }

    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateNoteUpdateBody(body);
    if (validation.error) return apiError(validation.error);
    const updates = validation.value;

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

    const nextProjectId = updates.projectId !== undefined ? updates.projectId : currentNote.project_id;
    const isMovingNote = updates.projectId !== undefined && nextProjectId !== currentNote.project_id;
    const isNoteCreator = currentNote.user_id === request.user.id;
    const isCurrentProjectOwner = Boolean(
      currentNote.project_id && (await isProjectOwner(request.user.id, currentNote.project_id))
    );

    if (!isNoteCreator && !isCurrentProjectOwner) {
      return apiError("Only the note creator or project creator can edit this note", 403);
    }

    if (isMovingNote) {
      if (nextProjectId) {
        const project = await getProjectForMember(request.user.id, nextProjectId);
        if (!project) {
          return apiError("Project not found", 404);
        }
      }
    }

    if (!nextProjectId && !(await userOwnsNotebook(request.user.id, updates.notebookId))) {
      return apiError("Notebook not found", 404);
    }

    if (updates.tags !== undefined) {
      const canUseTags = isCurrentProjectOwner
        ? await userOwnsOrNoteUsesAllTags(request.user.id, updates.tags, id)
        : await userOwnsAllTags(request.user.id, updates.tags);
      if (!canUseTags) return apiError("One or more tags are not available", 403);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(updates.content); }
    if (updates.notebookId !== undefined || (updates.projectId !== undefined && nextProjectId)) {
      fields.push(`notebook_id = $${paramIndex++}`);
      values.push(nextProjectId ? null : updates.notebookId);
    }
    if (updates.projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(updates.projectId); }
    if (updates.isPinned !== undefined) { fields.push(`is_pinned = $${paramIndex++}`); values.push(updates.isPinned); }

    const updatedNote = await transaction(async (client) => {
      if (fields.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE notes SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }

      if (updates.tags !== undefined) {
        await client.query("DELETE FROM note_tags WHERE note_id = $1", [id]);
        for (const tagId of updates.tags) {
          await client.query(
            "INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [id, tagId]
          );
        }
      }

      const result = await client.query(
        `SELECT n.*,
          nb.name AS notebook_name,
          p.name AS project_name,
          p.color AS project_color,
          ${projectOwnerCondition("n")} AS is_project_owner,
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

      const note = result.rows[0];
      if (isMovingNote && currentNote.project_id && !nextProjectId) {
        await recordProjectActivity({
          projectId: currentNote.project_id,
          actorUserId: request.user.id,
          action: "moved_to_personal",
          entityType: "note",
          entityId: currentNote.id,
          entityTitle: currentNote.title,
          db: client,
          strict: true,
        });
      } else if (nextProjectId) {
        await recordProjectActivity({
          projectId: nextProjectId,
          actorUserId: request.user.id,
          action: isMovingNote
            ? "moved_to_project"
            : "updated",
          entityType: "note",
          entityId: note.id,
          entityTitle: note.title,
          db: client,
          strict: true,
        });
      }

      return note;
    });

    return apiResponse({ note: updatedNote });
  } catch (error) {
    console.error("Note update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Note", { allowNull: false }).error) {
      return apiError("Note ID is invalid");
    }

    const existing = await query(
      `SELECT n.id, n.user_id, n.project_id, n.title
       FROM notes n
       WHERE ${projectScopedAccessCondition("n")} AND n.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Note not found", 404);
    }

    const note = existing.rows[0];
    const isCreator = note.user_id === request.user.id;
    const isOwner = note.project_id && (await isProjectOwner(request.user.id, note.project_id));

    const canDelete = note.project_id ? Boolean(isOwner) : isCreator;
    if (!canDelete) {
      return apiError("Only the project creator can delete project notes", 403);
    }

    await transaction(async (client) => {
      await client.query("DELETE FROM notes WHERE id = $1", [id]);

      if (note.project_id) {
        await recordProjectActivity({
          projectId: note.project_id,
          actorUserId: request.user.id,
          action: "deleted",
          entityType: "note",
          entityId: note.id,
          entityTitle: note.title,
          db: client,
          strict: true,
        });
      }
    });

    return apiResponse({ message: "Note deleted" });
  } catch (error) {
    console.error("Note delete error:", error);
    return apiError("Internal server error", 500);
  }
});
