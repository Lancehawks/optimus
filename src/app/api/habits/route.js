import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const isActive = searchParams.get("is_active");

    const conditions = ["h.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (isActive !== "false") {
      conditions.push("h.is_active = true");
    }

    if (category) {
      conditions.push(`h.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (search) {
      conditions.push(`h.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT h.*,
        (SELECT COUNT(*) FROM habit_logs hl
         WHERE hl.habit_id = h.id AND hl.completed = true
         AND hl.log_date >= CURRENT_DATE - INTERVAL '6 days') AS completed_last_7,
        EXISTS(SELECT 1 FROM habit_logs hl
         WHERE hl.habit_id = h.id AND hl.log_date = CURRENT_DATE
         AND hl.completed = true) AS completed_today
       FROM habits h
       WHERE ${conditions.join(" AND ")}
       ORDER BY h.created_at DESC`,
      params
    );

    return apiResponse({ habits: result.rows });
  } catch (error) {
    console.error("Habits list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { name, description, frequency, category, color } = body;

    if (!name || !name.trim()) {
      return apiError("Name is required");
    }

    const result = await query(
      `INSERT INTO habits (user_id, name, description, frequency, category, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.user.id,
        name.trim(),
        description || null,
        frequency || "daily",
        category || null,
        color || "#22c55e",
      ]
    );

    return apiResponse({ habit: result.rows[0] }, 201);
  } catch (error) {
    console.error("Habit create error:", error);
    return apiError("Internal server error", 500);
  }
});
