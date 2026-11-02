import { attemptGoogleDayPlanSync } from '@/lib/events/googleEventSyncService';
import { transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { normalizeDayPlanBlocks, saveDayPlan } from "@/lib/dayPlan";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { date, status } = body;
    if (typeof date !== "string" || !DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return apiError("date must use YYYY-MM-DD format");
    }
    if (!["accepted", "edited", "rejected"].includes(status)) {
      return apiError("status must be accepted, edited, or rejected");
    }

    let blocks;
    try {
      blocks = status === "rejected" ? [] : normalizeDayPlanBlocks(body.blocks, date);
    } catch (error) {
      return apiError(error.message);
    }

    const createdEvents = await transaction((client) => saveDayPlan(client, request.user.id, { date, status, blocks }));

    const syncResult = await attemptGoogleDayPlanSync({ userId: request.user.id, eventIds: createdEvents.map(event => event.id) });
    return apiResponse({ success: true, events: createdEvents, ...syncResult });
  } catch (error) {
    console.error("Day plan apply error:", error);
    return apiError("Internal server error", 500);
  }
});
