import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const deck = await query(
      "SELECT id FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (deck.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const result = await query(
      "SELECT * FROM flashcards WHERE deck_id = $1 ORDER BY created_at",
      [id]
    );

    return apiResponse({ cards: result.rows });
  } catch (error) {
    console.error("Flashcards list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const deck = await query(
      "SELECT id FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (deck.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const body = await request.json();
    const { front, back } = body;

    if (!front) {
      return apiError("Front text is required");
    }
    if (!back) {
      return apiError("Back text is required");
    }

    const result = await query(
      `INSERT INTO flashcards (deck_id, front, back, ease_factor, interval_days, next_review_at, review_count)
       VALUES ($1, $2, $3, 2.50, 0, NOW(), 0)
       RETURNING *`,
      [id, front, back]
    );

    return apiResponse({ card: result.rows[0] }, 201);
  } catch (error) {
    console.error("Flashcard create error:", error);
    return apiError("Internal server error", 500);
  }
});
