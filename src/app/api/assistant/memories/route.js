import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { assistantDb } from "@/lib/assistant/server";
import { MEMORY_ITEMS_MAX, MemoryError, addMemory, listMemories } from "@/lib/assistant/memory";
import { checkRateLimits } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

// Memory is managed whether or not the assistant is on: nothing is sent
// anywhere until an admin turns the assistant on for this member.
export const GET = withAuth(async (request) => {
  try {
    const memories = await listMemories(assistantDb, request.user.id);
    return apiNoStoreResponse({ memories, limit: MEMORY_ITEMS_MAX });
  } catch (error) {
    logError("assistant.memories_list_failed", error, { userId: request.user.id });
    return apiError("Could not load memory", 500);
  }
});

export const POST = withAuth(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  try {
    const rateLimit = await checkRateLimits(request, [
      { scope: "assistant:memory:write", identifier: request.user.id, limit: 60, windowMs: 60 * 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) return apiError("Too many changes. Try again later.", 429);
    const memory = await addMemory(assistantDb, request.user.id, body.content);
    return apiNoStoreResponse({ memory }, 201);
  } catch (error) {
    if (error instanceof MemoryError) return apiError(error.message, error.status);
    logError("assistant.memory_create_failed", error, { userId: request.user.id });
    return apiError("Could not save the memory", 500);
  }
});
