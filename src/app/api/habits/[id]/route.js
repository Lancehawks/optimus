import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const habitResult = await query(
      "SELECT * FROM habits WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (habitResult.rows.length === 0) {
      return apiError("Habit not found", 404);
    }

    const logsResult = await query(
      `SELECT id, habit_id, log_date, completed, notes, created_at
       FROM habit_logs
       WHERE habit_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY log_date DESC`,
      [id]
    );

    return apiResponse({ habit: habitResult.rows[0], logs: logsResult.rows });
  } catch (error) {
    console.error("Habit get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, frequency, category, color, isActive } = body;

    const existing = await query(
      "SELECT id FROM habits WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Habit not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (frequency !== undefined) {
      fields.push(`frequency = $${paramIndex++}`);
      values.push(frequency);
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(category || null);
    }
    if (color !== undefined) {
      fields.push(`color = $${paramIndex++}`);
      values.push(color);
    }
    if (isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await query(
        `UPDATE habits SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    const result = await query("SELECT * FROM habits WHERE id = $1", [id]);
    return apiResponse({ habit: result.rows[0] });
  } catch (error) {
    console.error("Habit update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Habit not found", 404);
    }

    return apiResponse({ message: "Habit deleted" });
  } catch (error) {
    console.error("Habit delete error:", error);
    return apiError("Internal server error", 500);
  }
});
