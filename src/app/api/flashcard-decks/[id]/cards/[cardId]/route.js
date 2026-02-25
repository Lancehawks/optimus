import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id, cardId } = await params;

    const deck = await query(
      "SELECT id FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (deck.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const body = await request.json();
    const { front, back } = body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (front !== undefined) { fields.push(`front = $${paramIndex++}`); values.push(front); }
    if (back !== undefined) { fields.push(`back = $${paramIndex++}`); values.push(back); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(cardId);
    values.push(id);

    const result = await query(
      `UPDATE flashcards SET ${fields.join(", ")} WHERE id = $${paramIndex} AND deck_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return apiError("Card not found", 404);
    }

    return apiResponse({ card: result.rows[0] });
  } catch (error) {
    console.error("Flashcard update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id, cardId } = await params;

    const deck = await query(
      "SELECT id FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (deck.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const result = await query(
      "DELETE FROM flashcards WHERE id = $1 AND deck_id = $2 RETURNING id",
      [cardId, id]
    );

    if (result.rows.length === 0) {
      return apiError("Card not found", 404);
    }

    return apiResponse({ message: "Card deleted" });
  } catch (error) {
    console.error("Flashcard delete error:", error);
    return apiError("Internal server error", 500);
  }
});
