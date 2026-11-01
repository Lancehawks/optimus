import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { loadTodayRoutineLogs } from "@/lib/routineLogs";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT cs.*,
        COALESCE(
          json_agg(
            json_build_object('id', ci.id, 'name', ci.name, 'position', ci.position)
            ORDER BY ci.position
          ) FILTER (WHERE ci.id IS NOT NULL),
          '[]'
        ) AS items
       FROM checklist_sections cs
       LEFT JOIN checklist_items ci ON ci.section_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id
       ORDER BY cs.position ASC`,
      [request.user.id]
    );

    const todayLogs = await loadTodayRoutineLogs({ query }, request.user);

    return apiResponse({ sections: result.rows, todayLogs });
  } catch (error) {
    console.error("Checklist sections list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return apiError("Name is required");
    }

    // Get next position
    const posResult = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM checklist_sections WHERE user_id = $1",
      [request.user.id]
    );

    const result = await query(
      `INSERT INTO checklist_sections (user_id, name, color, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.user.id, name.trim(), color || "#0d6b88", posResult.rows[0].next_pos]
    );

    return apiResponse({ section: { ...result.rows[0], items: [] } }, 201);
  } catch (error) {
    console.error("Checklist section create error:", error);
    return apiError("Internal server error", 500);
  }
});
