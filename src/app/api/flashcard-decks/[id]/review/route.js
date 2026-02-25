import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

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
    const { cardId, grade } = body;

    if (!cardId) {
      return apiError("Card ID is required");
    }
    if (grade === undefined || ![0, 2, 3, 5].includes(grade)) {
      return apiError("Grade must be 0, 2, 3, or 5");
    }

    const cardResult = await query(
      "SELECT * FROM flashcards WHERE id = $1 AND deck_id = $2",
      [cardId, id]
    );
    if (cardResult.rows.length === 0) {
      return apiError("Card not found", 404);
    }

    const card = cardResult.rows[0];
    let { ease_factor, interval_days, review_count } = card;
    ease_factor = parseFloat(ease_factor);

    if (grade >= 3) {
      if (review_count === 0) interval_days = 1;
      else if (review_count === 1) interval_days = 6;
      else interval_days = Math.round(interval_days * ease_factor);
      ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
      review_count += 1;
    } else {
      interval_days = 1;
      review_count = 0;
    }

    const result = await query(
      `UPDATE flashcards SET
        ease_factor = $1,
        interval_days = $2,
        next_review_at = NOW() + ($2 || ' days')::interval,
        review_count = $3,
        last_reviewed_at = NOW(),
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [ease_factor, interval_days, review_count, cardId]
    );

    return apiResponse({ card: result.rows[0] });
  } catch (error) {
    console.error("Flashcard review error:", error);
    return apiError("Internal server error", 500);
  }
});
