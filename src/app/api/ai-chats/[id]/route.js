import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, context) => {
  try {
    const { id } = await context.params;

    const chatResult = await query(
      `SELECT * FROM ai_chats WHERE id = $1 AND user_id = $2`,
      [id, request.user.id]
    );

    if (chatResult.rows.length === 0) {
      return apiError("Chat not found", 404);
    }

    const messagesResult = await query(
      `SELECT id, role, content, created_at
       FROM ai_messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    return apiResponse({
      chat: chatResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (error) {
    return apiError("Failed to fetch chat", 500);
  }
});

export const PUT = withAuth(async (request, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Verify ownership
    const existing = await query(
      `SELECT id FROM ai_chats WHERE id = $1 AND user_id = $2`,
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Chat not found", 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (body.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(body.title);
    }
    if (body.model !== undefined) {
      fields.push(`model = $${idx++}`);
      values.push(body.model);
    }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    values.push(id);
    const result = await query(
      `UPDATE ai_chats SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return apiResponse({ chat: result.rows[0] });
  } catch (error) {
    return apiError("Failed to update chat", 500);
  }
});

export const DELETE = withAuth(async (request, context) => {
  try {
    const { id } = await context.params;

    const result = await query(
      `DELETE FROM ai_chats WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Chat not found", 404);
    }

    return apiResponse({ message: "Chat deleted" });
  } catch (error) {
    return apiError("Failed to delete chat", 500);
  }
});
