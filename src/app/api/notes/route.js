import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";
import {
  firstValidationError,
  optionalBoolean,
  optionalDate,
  optionalString,
  optionalUuid,
  parseJsonObject,
  requiredString,
  uuidArray,
} from "@/lib/apiValidation";
import { userOwnsAllTags } from "@/lib/tagAccess";
import { userOwnsNotebook } from "@/lib/notebookAccess";

function validateNoteCreateBody(body) {
  const title = requiredString(body.title, "Title", { max: 255 });
  const content = optionalString(body.content, "Content", {
    max: 500000,
    emptyToNull: false,
    trim: false,
  });
  const notebookId = optionalUuid(body.notebookId, "Notebook");
  const projectId = optionalUuid(body.projectId, "Project");
  const isJournal = optionalBoolean(body.isJournal, "Journal");
  const journalDate = optionalDate(body.journalDate, "Journal date");
  const templateName = optionalString(body.templateName, "Template name", { max: 100 });
  const tags = uuidArray(body.tags, "Tags", { max: 100 });

  const error = firstValidationError(
    title,
    content,
    notebookId,
    projectId,
    isJournal,
    journalDate,
    templateName,
    tags
  );
  if (error) return { error };

  return {
    value: {
      title: title.value,
      content: content.provided ? content.value : "",
      notebookId: notebookId.provided ? notebookId.value : null,
      projectId: projectId.provided ? projectId.value : null,
      isJournal: isJournal.provided ? isJournal.value : false,
      journalDate: journalDate.provided ? journalDate.value : null,
      templateName: templateName.provided ? templateName.value : null,
      tags: tags.provided ? tags.value : [],
    },
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const notebookId = searchParams.get("notebook_id");
    const isJournal = searchParams.get("is_journal");
    const isPinned = searchParams.get("is_pinned");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "updated_at";
    const order = searchParams.get("order") || "desc";

    const conditions = [projectScopedAccessCondition("n")];
    const params = [request.user.id];
    let paramIndex = 2;

    if (notebookId) {
      if (optionalUuid(notebookId, "Notebook", { allowNull: false }).error) {
        return apiError("Notebook filter is invalid");
      }
      conditions.push(`n.notebook_id = $${paramIndex++}`);
      params.push(notebookId);
    }
    if (isJournal === "true") {
      conditions.push("n.is_journal = true");
    }
    if (isPinned === "true") {
      conditions.push("n.is_pinned = true");
    }
    const projectId = searchParams.get("project_id");
    if (projectId) {
      if (optionalUuid(projectId, "Project", { allowNull: false }).error) {
        return apiError("Project filter is invalid");
      }
      conditions.push(`n.project_id = $${paramIndex++}`);
      params.push(projectId);
    }
    if (search) {
      conditions.push(`(n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const sortColumns = {
      updated_at: "n.updated_at",
      created_at: "n.created_at",
      title: "n.title",
    };
    const sortCol = sortColumns[sort] || "n.updated_at";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

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
       WHERE ${conditions.join(" AND ")}
       GROUP BY n.id, nb.name, p.name, p.color
       ORDER BY n.is_pinned DESC, ${sortCol} ${sortOrder}`,
      params
    );

    return apiResponse({ notes: result.rows });
  } catch (error) {
    console.error("Notes list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateNoteCreateBody(body);
    if (validation.error) return apiError(validation.error);

    const { title, content, notebookId, projectId, isJournal, journalDate, templateName, tags } =
      validation.value;
    const targetProjectId = projectId || null;

    if (targetProjectId) {
      const project = await getProjectForMember(request.user.id, targetProjectId);
      if (!project) {
        return apiError("Project not found", 404);
      }
    }

    if (!targetProjectId && !(await userOwnsNotebook(request.user.id, notebookId))) {
      return apiError("Notebook not found", 404);
    }

    if (!(await userOwnsAllTags(request.user.id, tags))) {
      return apiError("One or more tags are not available", 403);
    }

    const note = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO notes (user_id, notebook_id, project_id, title, content, is_journal, journal_date, template_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          request.user.id,
          targetProjectId ? null : notebookId,
          targetProjectId,
          title,
          content,
          isJournal,
          journalDate,
          templateName,
        ]
      );

      const createdNote = result.rows[0];

      for (const tagId of tags) {
        await client.query(
          "INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [createdNote.id, tagId]
        );
      }

      if (targetProjectId) {
        await recordProjectActivity({
          projectId: targetProjectId,
          actorUserId: request.user.id,
          action: "created",
          entityType: "note",
          entityId: createdNote.id,
          entityTitle: createdNote.title,
          db: client,
          strict: true,
        });
      }

      return createdNote;
    });

    return apiResponse({ note }, 201);
  } catch (error) {
    console.error("Note create error:", error);
    return apiError("Internal server error", 500);
  }
});
