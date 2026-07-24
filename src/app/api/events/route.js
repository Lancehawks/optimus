import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { createEvent, listEventsForRange } from "@/lib/events/eventCollectionService";
import { EventRouteError } from "@/lib/events/eventErrors";

function handleEventServiceError(error) {
  if (error instanceof EventRouteError) {
    return apiError(error.message, error.status);
  }

  throw error;
}

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);

  try {
    return apiResponse(await listEventsForRange({
      userId: request.user.id,
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      calendarId: searchParams.get("calendar_id"),
    }));
  } catch (error) {
    return handleEventServiceError(error);
  }
});

export const POST = withAuth(async (request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError("Request body must be a JSON object");
  }

  try {
    return apiResponse(await createEvent({
      userId: request.user.id,
      body,
    }), 201);
  } catch (error) {
    return handleEventServiceError(error);
  }
});
