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
import { deleteBlobs } from "@/lib/blobStorage";
import { optionalContentBlocks, optionalRevision, snapshotNoteBeforeChange } from "@/lib/noteContent";

class NoteConflict extends Error {
  constructor(note) {
    super("This note was changed somewhere else since you opened it.");
    this.note = note;
  }
}

function noteDetailQuery(client, userId, noteId) {
  return client.query(
    `SELECT n.*,
      nb.name AS notebook_name,
      p.name AS project_name,
      p.color AS project_color,
      editor.full_name AS updated_by_name,
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
     LEFT JOIN users editor ON editor.id = n.updated_by
     LEFT JOIN note_tags nt ON nt.note_id = n.id
     LEFT JOIN tags tg ON tg.id = nt.tag_id
     WHERE ${projectScopedAccessCondition("n")} AND n.id = $2
     GROUP BY n.id, nb.name, p.name, p.color, editor.full_name`,
    [userId, noteId]
  );
}

function validateNoteUpdateBody(body) {
  const title = optionalRequiredString(body.title, "Title", { max: 255 });
  const content = optionalString(body.content, "Content", {
    max: 500000,
    emptyToNull: false,
    trim: false,
  });
  const contentBlocks = optionalContentBlocks(body.contentBlocks);
  const notebookId = optionalUuid(body.notebookId, "Notebook");
  const projectId = optionalUuid(body.projectId, "Project");
  const isPinned = optionalBoolean(body.isPinned, "Pinned");
  const tags = uuidArray(body.tags, "Tags", { max: 100 });
  const baseRevision = optionalRevision(body.baseRevision);
  const snapshot = optionalBoolean(body.snapshot, "Snapshot");

  const error = firstValidationError(title, content, contentBlocks, notebookId, projectId, isPinned, tags, baseRevision, snapshot);
  if (error) return { error };
  if (contentBlocks.provided && !content.provided) {
    return { error: "Content blocks must be saved with content" };
  }

  const value = {
    // The revision the editor last loaded; a title or content change made
    // against an older one is a conflict.
    baseRevision: baseRevision.provided ? baseRevision.value : null,
    // Restores and overwrites always keep the replaced state.
    forceSnapshot: snapshot.provided && snapshot.value,
  };
  if (title.provided) value.title = title.value;
  if (content.provided) {
    value.content = content.value;
    // HTML written without blocks replaces the note, so drop the stale blocks.
    value.contentBlocks = contentBlocks.provided ? contentBlocks.value : null;
  }
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

    const result = await noteDetailQuery({ query }, request.user.id, id);

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
    const changesText = updates.title !== undefined || updates.content !== undefined;

    if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push(`content = $${paramIndex++}`); values.push(updates.content); }
    if (updates.contentBlocks !== undefined) { fields.push(`content_blocks = $${paramIndex++}::jsonb`); values.push(updates.contentBlocks); }
    if (updates.notebookId !== undefined || (updates.projectId !== undefined && nextProjectId)) {
      fields.push(`notebook_id = $${paramIndex++}`);
      values.push(nextProjectId ? null : updates.notebookId);
    }
    if (updates.projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(updates.projectId); }
    if (updates.isPinned !== undefined) { fields.push(`is_pinned = $${paramIndex++}`); values.push(updates.isPinned); }
    if (changesText) {
      fields.push("revision = revision + 1");
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(request.user.id);
    }

    const updatedNote = await transaction(async (client) => {
      if (changesText) {
        // Locked so two saves made against the same revision can't both pass.
        const locked = await client.query("SELECT * FROM notes WHERE id = $1 FOR UPDATE", [id]);
        const lockedNote = locked.rows[0];
        if (updates.baseRevision !== null && updates.baseRevision !== lockedNote.revision) {
          const latest = await noteDetailQuery(client, request.user.id, id);
          throw new NoteConflict(latest.rows[0]);
        }
        await snapshotNoteBeforeChange(client, lockedNote, { force: updates.forceSnapshot });
      }

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

      const result = await noteDetailQuery(client, request.user.id, id);

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
    if (error instanceof NoteConflict) {
      return apiResponse({ error: error.message, code: "note_conflict", note: error.note }, 409);
    }
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

    // Attachments go with the note: its versions are deleted too, so nothing
    // could show them again.
    const removedFiles = await transaction(async (client) => {
      const files = await client.query("DELETE FROM uploaded_files WHERE note_id = $1 RETURNING pathname", [id]);
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
      return files.rows.map((file) => file.pathname);
    });
    await deleteBlobs(removedFiles);

    return apiResponse({ message: "Note deleted" });
  } catch (error) {
    console.error("Note delete error:", error);
    return apiError("Internal server error", 500);
  }
});
