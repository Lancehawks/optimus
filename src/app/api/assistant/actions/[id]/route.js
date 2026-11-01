import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { resolveTimeZone } from "@/lib/calendarTime";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { checkRateLimits } from "@/lib/rateLimit";
import { decideAction } from "@/lib/assistant/actions";
import { assistantDb } from "@/lib/assistant/server";
import { createEvent } from "@/lib/events/eventCollectionService";
import { updateEventDetails } from "@/lib/events/eventDetailService";
import { attemptGoogleDayPlanSync } from "@/lib/events/googleEventSyncService";
import { logError } from "@/lib/logger";

// The member's answer to a change the assistant proposed. No model is involved
// here: the change runs as the member, from what was stored with the proposal.
export const POST = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (optionalUuid(id, "Action", { allowNull: false }).error) return apiError("Action ID is invalid");
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  if (body.decision !== "confirm" && body.decision !== "cancel") return apiError("Decision must be confirm or cancel");

  const userId = request.user.id;
  try {
    const rateLimit = await checkRateLimits(request, [
      { scope: "assistant:action:minute", identifier: userId, limit: 60, windowMs: 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) return apiError("You're going quickly. Wait a moment and try again.", 429);

    const action = await decideAction({
      db: assistantDb,
      userId,
      timeZone: resolveTimeZone(request.user.timezone),
      createEvent,
      updateEvent: updateEventDetails,
      syncDayPlan: attemptGoogleDayPlanSync,
      recordActivity: recordProjectActivity,
      onError: (error, tool) => logError("assistant.action_failed", error, { userId, tool }),
    }, id, body.decision);
    if (!action) return apiError("That change wasn't found", 404);
    return apiNoStoreResponse({ action });
  } catch (error) {
    logError("assistant.action_decision_failed", error, { userId });
    return apiError("Could not save your decision", 500);
  }
});
