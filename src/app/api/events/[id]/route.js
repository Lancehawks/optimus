import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import {
  deleteEventDetails,
  getEventDetails,
  updateEventDetails,
} from "@/lib/events/eventDetailService";
import { EventRouteError } from "@/lib/events/eventErrors";

function handleEventServiceError(error) {
  if (error instanceof EventRouteError) {
    return apiError(error.message, error.status);
  }

  throw error;
}

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;

  try {
    return apiResponse(await getEventDetails({ userId: request.user.id, id }));
  } catch (error) {
    return handleEventServiceError(error);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();

  try {
    return apiResponse(await updateEventDetails({
      userId: request.user.id,
      id,
      body,
    }));
  } catch (error) {
    return handleEventServiceError(error);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;

  try {
    return apiResponse(await deleteEventDetails({ userId: request.user.id, id }));
  } catch (error) {
    return handleEventServiceError(error);
  }
});
