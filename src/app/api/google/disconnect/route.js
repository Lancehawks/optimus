import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { transaction } from "@/lib/db";

export const POST = withAuth(async (request) => {
  try {
    const result = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google-disconnect:${request.user.id}`]);
      const connection = await client.query(
        "DELETE FROM google_connections WHERE user_id = $1 RETURNING id",
        [request.user.id]
      );
      if (connection.rows.length === 0) return { connected: false };

      await client.query("DELETE FROM calendars WHERE user_id = $1 AND is_google = TRUE", [request.user.id]);
      const localCalendar = await client.query(
        `SELECT id FROM calendars
         WHERE user_id = $1 AND COALESCE(is_google, FALSE) = FALSE
         ORDER BY created_at, id LIMIT 1`,
        [request.user.id]
      );

      if (localCalendar.rows.length > 0) {
        await client.query("UPDATE calendars SET is_default = FALSE WHERE user_id = $1", [request.user.id]);
        await client.query("UPDATE calendars SET is_default = TRUE WHERE id = $1", [localCalendar.rows[0].id]);
      } else {
        await client.query(
          `INSERT INTO calendars (user_id, name, color, is_default, is_google)
           VALUES ($1, 'My Calendar', '#0d6b88', TRUE, FALSE)`,
          [request.user.id]
        );
      }
      return { connected: true };
    });

    if (!result.connected) return apiError("Google not connected", 400);
    return apiResponse({ message: "Google account disconnected" });
  } catch (error) {
    console.error("Google disconnect error:", error);
    return apiError("Could not disconnect Google Calendar", 500);
  }
});
