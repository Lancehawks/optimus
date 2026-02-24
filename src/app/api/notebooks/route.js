import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT nb.*,
        (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id)::int AS note_count
       FROM notebooks nb
       WHERE nb.user_id = $1
       ORDER BY nb.position ASC, nb.name ASC`,
      [request.user.id]
    );

    return apiResponse({ notebooks: result.rows });
  } catch (error) {
    console.error("Notebooks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { name, parentId } = await request.json();

    if (!name) {
      return apiError("Notebook name is required");
    }

    const posResult = await query(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM notebooks WHERE user_id = $1",
      [request.user.id]
    );

    const result = await query(
      `INSERT INTO notebooks (user_id, name, parent_id, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.user.id, name, parentId || null, posResult.rows[0].next_pos]
    );

    return apiResponse({ notebook: { ...result.rows[0], note_count: 0 } }, 201);
  } catch (error) {
    console.error("Notebook create error:", error);
    return apiError("Internal server error", 500);
  }
});
