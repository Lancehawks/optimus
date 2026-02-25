import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT fd.*,
        (SELECT COUNT(*) FROM flashcards WHERE deck_id = fd.id)::int AS card_count,
        (SELECT COUNT(*) FROM flashcards WHERE deck_id = fd.id AND next_review_at <= NOW())::int AS due_count
       FROM flashcard_decks fd
       WHERE fd.user_id = $1
       ORDER BY fd.created_at DESC`,
      [request.user.id]
    );

    return apiResponse({ decks: result.rows });
  } catch (error) {
    console.error("Flashcard decks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return apiError("Name is required");
    }

    const result = await query(
      `INSERT INTO flashcard_decks (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [request.user.id, name, description || null]
    );

    return apiResponse({ deck: result.rows[0] }, 201);
  } catch (error) {
    console.error("Flashcard deck create error:", error);
    return apiError("Internal server error", 500);
  }
});
