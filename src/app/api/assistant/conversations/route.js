import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { assistantDb } from "@/lib/assistant/server";
import { deleteAllConversations, listConversations } from "@/lib/assistant/store";
import { logError } from "@/lib/logger";

// A member's own conversations stay readable whatever their access; reading
// them sends nothing to a model provider.
export const GET = withAuth(async (request) => {
  try {
    const conversations = await listConversations(assistantDb, request.user.id);
    return apiNoStoreResponse({ conversations });
  } catch (error) {
    logError("assistant.conversations_list_failed", error, { userId: request.user.id });
    return apiError("Could not load conversations", 500);
  }
});

export const DELETE = withAuth(async (request) => {
  try {
    const deleted = await deleteAllConversations(assistantDb, request.user.id);
    return apiNoStoreResponse({ deleted });
  } catch (error) {
    logError("assistant.conversations_delete_failed", error, { userId: request.user.id });
    return apiError("Could not delete assistant history", 500);
  }
});
