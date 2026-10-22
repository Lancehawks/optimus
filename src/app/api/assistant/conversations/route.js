import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { assistantDb, assistantDisabledResponse } from "@/lib/assistant/server";
import { deleteAllConversations, listConversations } from "@/lib/assistant/store";
import { logError } from "@/lib/logger";

export const GET = withAuth(async (request) => {
  const disabled = assistantDisabledResponse(request.user);
  if (disabled) return disabled;
  try {
    const conversations = await listConversations(assistantDb, request.user.id);
    return apiNoStoreResponse({ conversations });
  } catch (error) {
    logError("assistant.conversations_list_failed", error, { userId: request.user.id });
    return apiError("Could not load conversations", 500);
  }
});

// Deleting history works with the assistant off, so a member who opts out can
// still remove everything they sent.
export const DELETE = withAuth(async (request) => {
  try {
    const deleted = await deleteAllConversations(assistantDb, request.user.id);
    return apiNoStoreResponse({ deleted });
  } catch (error) {
    logError("assistant.conversations_delete_failed", error, { userId: request.user.id });
    return apiError("Could not delete assistant history", 500);
  }
});
