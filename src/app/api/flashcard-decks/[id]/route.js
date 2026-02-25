import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const deckResult = await query(
      "SELECT * FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (deckResult.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const cardsResult = await query(
      "SELECT * FROM flashcards WHERE deck_id = $1 ORDER BY created_at",
      [id]
    );

    return apiResponse({
      deck: deckResult.rows[0],
      cards: cardsResult.rows,
    });
  } catch (error) {
    console.error("Flashcard deck get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    const existing = await query(
      "SELECT id FROM flashcard_decks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE flashcard_decks SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return apiResponse({ deck: result.rows[0] });
  } catch (error) {
    console.error("Flashcard deck update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM flashcard_decks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Deck not found", 404);
    }

    return apiResponse({ message: "Deck deleted" });
  } catch (error) {
    console.error("Flashcard deck delete error:", error);
    return apiError("Internal server error", 500);
  }
});
