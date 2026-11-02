import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { assistantDb } from "@/lib/assistant/server";
import { MemoryError, deleteMemory, updateMemory } from "@/lib/assistant/memory";
import { logError } from "@/lib/logger";

function invalidId(id) {
  return optionalUuid(id, "Memory", { allowNull: false }).error;
}

export const PUT = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Memory ID is invalid");
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  try {
    const memory = await updateMemory(assistantDb, request.user.id, id, body.content);
    return apiNoStoreResponse({ memory });
  } catch (error) {
    if (error instanceof MemoryError) return apiError(error.message, error.status);
    logError("assistant.memory_update_failed", error, { userId: request.user.id });
    return apiError("Could not save the memory", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Memory ID is invalid");
  try {
    await deleteMemory(assistantDb, request.user.id, id);
    return apiNoStoreResponse({ deleted: true });
  } catch (error) {
    if (error instanceof MemoryError) return apiError(error.message, error.status);
    logError("assistant.memory_delete_failed", error, { userId: request.user.id });
    return apiError("Could not delete the memory", 500);
  }
});
