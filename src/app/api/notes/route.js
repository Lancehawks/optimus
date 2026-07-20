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
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

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
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"), [
      "sort", "order", "isPinned", "valueIsNull", "createdAt", "id",
    ]);
    if (cursor.error) return apiError(cursor.error);

    const conditions = [projectScopedAccessCondition("n")];
    const scopeConditions = [...conditions];
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
      if (search.length > 200) return apiError("Search must be 200 characters or less");
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

    if (cursor.value && (cursor.value.sort !== sort || cursor.value.order !== sortOrder.toLowerCase())) {
      return apiError("Pagination cursor does not match the requested sort");
    }

    let cursorCondition = "";
    if (cursor.value) {
      const pinnedParam = paramIndex++;
      params.push(cursor.value.isPinned);
      let withinPinned;
      if (cursor.value.valueIsNull) {
        withinPinned = `page_source.__sort_value IS NULL
          AND (page_source.created_at, page_source.id) < ($${paramIndex}::timestamptz, $${paramIndex + 1}::uuid)`;
        params.push(cursor.value.createdAt, cursor.value.id);
        paramIndex += 2;
      } else {
        const valueParam = paramIndex;
        const comparison = sortOrder === "DESC" ? "<" : ">";
        withinPinned = `(
          page_source.__sort_value ${comparison} $${valueParam}
          OR (page_source.__sort_value = $${valueParam}
            AND (page_source.created_at, page_source.id) < ($${valueParam + 1}::timestamptz, $${valueParam + 2}::uuid))
          OR page_source.__sort_value IS NULL
        )`;
        params.push(cursor.value.value, cursor.value.createdAt, cursor.value.id);
        paramIndex += 3;
      }
      cursorCondition = `WHERE (page_source.is_pinned < $${pinnedParam}::boolean
        OR (page_source.is_pinned = $${pinnedParam}::boolean AND (${withinPinned})))`;
    }

    const result = await query(
      `WITH filtered_notes AS (
         SELECT n.*, nb.name AS notebook_name,
                p.name AS project_name, p.color AS project_color,
                ${projectOwnerCondition("n")} AS is_project_owner,
                ${sortCol} AS __sort_value
         FROM notes n
         LEFT JOIN notebooks nb ON nb.id = n.notebook_id AND nb.user_id = $1
         LEFT JOIN projects p ON p.id = n.project_id
         WHERE ${conditions.join(" AND ")}
       ),
       page AS (
         SELECT page_source.*,
                (SELECT COUNT(*)::int FROM filtered_notes) AS __filtered_count,
                (SELECT COUNT(*)::int FROM notes n WHERE ${scopeConditions.join(" AND ")}) AS __total_count
         FROM filtered_notes page_source
         ${cursorCondition}
         ORDER BY page_source.is_pinned DESC, page_source.__sort_value ${sortOrder} NULLS LAST,
                  page_source.created_at DESC, page_source.id DESC
         LIMIT $${paramIndex}
       ),
       tag_rollup AS (
         SELECT nt.note_id,
                json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)) AS tags
         FROM note_tags nt JOIN tags tg ON tg.id = nt.tag_id
         JOIN page ON page.id = nt.note_id GROUP BY nt.note_id
       )
       SELECT page.*, COALESCE(tags.tags, '[]') AS tags
       FROM page LEFT JOIN tag_rollup tags ON tags.note_id = page.id
       ORDER BY page.is_pinned DESC, page.__sort_value ${sortOrder} NULLS LAST,
                page.created_at DESC, page.id DESC`,
      [...params, limit + 1]
    );

    const counts = result.rows[0] || {};
    const page = finishCursorPage(result.rows, limit, (row) => ({
      sort,
      order: sortOrder.toLowerCase(),
      isPinned: row.is_pinned,
      valueIsNull: row.__sort_value == null,
      value: row.__sort_value,
      createdAt: row.created_at,
      id: row.id,
    }));
    const notes = page.items.map(({ __sort_value, __filtered_count, __total_count, ...note }) => note);
    return apiResponse({ notes, pagination: { ...page.pagination, totalCount: counts.__total_count || 0, filteredCount: counts.__filtered_count || 0 } });
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
