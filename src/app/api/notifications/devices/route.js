import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import {
  PushDeviceConflictError,
  PushDeviceLimitError,
  registerPushDevice,
  unregisterPushDevice,
} from "@/lib/pushDevices";
import {
  normalizePushDeviceId,
  normalizePushDeviceRegistration,
} from "@/lib/pushDeviceValidation";
import { getTokenFromRequest } from "@/lib/auth";
import { logError } from "@/lib/logger";

export const POST = withAuth(async (request) => {
  try {
    const input = normalizePushDeviceRegistration(
      await request.json().catch(() => ({}))
    );
    if (input.error) return apiError(input.error);
    const sessionToken = getTokenFromRequest(request);
    if (!sessionToken) return apiError("Unauthorized", 401);

    const device = await registerPushDevice(
      request.user.id,
      sessionToken,
      input.value
    );
    if (!device) return apiError("Unauthorized", 401);

    return apiNoStoreResponse({ device });
  } catch (error) {
    if (error instanceof PushDeviceConflictError || error instanceof PushDeviceLimitError) {
      return apiError(error.message, 409);
    }
    if (error?.code === "23505") {
      return apiError("This push token is already registered to another device or account", 409);
    }

    logError("push_device.registration_failed", error, { userId: request.user.id });
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = normalizePushDeviceId(body.deviceId);
    if (deviceId.error) return apiError(deviceId.error);
    const sessionToken = getTokenFromRequest(request);
    if (!sessionToken) return apiError("Unauthorized", 401);

    const removed = await unregisterPushDevice(
      request.user.id,
      sessionToken,
      deviceId.value
    );
    return apiNoStoreResponse({ removed });
  } catch (error) {
    logError("push_device.removal_failed", error, { userId: request.user.id });
    return apiError("Internal server error", 500);
  }
});
