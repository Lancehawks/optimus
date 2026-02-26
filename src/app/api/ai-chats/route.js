import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT id, title, model, created_at, updated_at
       FROM ai_chats
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [request.user.id]
    );
    return apiResponse({ chats: result.rows });
  } catch (error) {
    return apiError("Failed to fetch chats", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { title, model } = await request.json();

    const result = await query(
      `INSERT INTO ai_chats (user_id, title, model)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [request.user.id, title || "New Chat", model || null]
    );

    return apiResponse({ chat: result.rows[0] }, 201);
  } catch (error) {
    return apiError("Failed to create chat", 500);
  }
});
