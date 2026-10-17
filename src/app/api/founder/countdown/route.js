import { founderBody } from "@/lib/founderValues";
import { query } from "@/lib/db";
import { hasFounderAccess } from "@/lib/founderAccess";
import {
  apiError,
  apiNoStoreResponse,
  apiUnavailable,
  withAuth,
} from "@/lib/apiUtils";

async function requireUnlockedLobby(userId) {
  try {
    return await hasFounderAccess(userId);
  } catch (error) {
    console.error("Founder Lobby access check error:", error);
    return null;
  }
}

function presentCountdown(row) {
  return {
    title: row.countdown_title,
    targetAt: row.countdown_target_at,
    updatedAt: row.updated_at,
  };
}

export const GET = withAuth(async (request) => {
  const unlocked = await requireUnlockedLobby(request.user.id);
  if (unlocked === null) return apiUnavailable("Founder Lobby is temporarily unavailable");
  if (!unlocked) return apiError("Founder Lobby is locked", 403);

  try {
    const result = await query(
      `SELECT countdown_title, countdown_target_at, updated_at
       FROM founder_lobby_settings
       WHERE id = 1`
    );

    if (!result.rows[0]) return apiUnavailable("Founder countdown is not configured");
    return apiNoStoreResponse({ countdown: presentCountdown(result.rows[0]) });
  } catch (error) {
    console.error("Founder countdown read error:", error);
    return apiUnavailable("Founder countdown is temporarily unavailable");
  }
});

export const PUT = withAuth(async (request) => {
  const unlocked = await requireUnlockedLobby(request.user.id);
  if (unlocked === null) return apiUnavailable("Founder Lobby is temporarily unavailable");
  if (!unlocked) return apiError("Founder Lobby is locked", 403);

  const body = founderBody(await request.json().catch(() => null));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const targetAt = typeof body.targetAt === "string" ? new Date(body.targetAt) : null;

  if (!title) return apiError("Milestone name is required");
  if (title.length > 120) return apiError("Milestone name must be 120 characters or less");
  if (!targetAt || Number.isNaN(targetAt.getTime())) return apiError("Choose a valid target date and time");
  if (targetAt.getTime() <= Date.now()) return apiError("The target must be in the future");

  try {
    const result = await query(
      `UPDATE founder_lobby_settings
       SET countdown_title = $1,
           countdown_target_at = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = 1
       RETURNING countdown_title, countdown_target_at, updated_at`,
      [title, targetAt.toISOString(), request.user.id]
    );

    if (!result.rows[0]) return apiUnavailable("Founder countdown is not configured");
    return apiNoStoreResponse({ countdown: presentCountdown(result.rows[0]) });
  } catch (error) {
    console.error("Founder countdown update error:", error);
    return apiUnavailable("Founder countdown could not be updated");
  }
});
