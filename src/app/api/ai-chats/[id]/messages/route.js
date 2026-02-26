import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request, context) => {
  try {
    const { id } = await context.params;
    const { role, content } = await request.json();

    if (!role || !content) {
      return apiError("Role and content are required");
    }

    // Verify ownership
    const chat = await query(
      `SELECT id FROM ai_chats WHERE id = $1 AND user_id = $2`,
      [id, request.user.id]
    );
    if (chat.rows.length === 0) {
      return apiError("Chat not found", 404);
    }

    const result = await query(
      `INSERT INTO ai_messages (chat_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, role, content]
    );

    // Update chat's updated_at
    await query(
      `UPDATE ai_chats SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return apiResponse({ message: result.rows[0] }, 201);
  } catch (error) {
    return apiError("Failed to add message", 500);
  }
});
