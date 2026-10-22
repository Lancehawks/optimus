import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";
import { modelKey } from "@/lib/ai/models";
import { assistantDb } from "@/lib/assistant/server";
import { deleteConversation, displayMessages, getConversation, loadHistory, modelLabel } from "@/lib/assistant/store";
import { logError } from "@/lib/logger";

function invalidId(id) {
  return optionalUuid(id, "Conversation", { allowNull: false }).error;
}

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Conversation ID is invalid");
  try {
    const conversation = await getConversation(assistantDb, request.user.id, id);
    if (!conversation) return apiError("Conversation not found", 404);
    const history = await loadHistory(assistantDb, id);
    return apiNoStoreResponse({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        updated_at: conversation.updated_at,
        model: modelKey(conversation.provider, conversation.model),
        modelLabel: modelLabel(conversation.provider, conversation.model),
      },
      messages: displayMessages(history),
    });
  } catch (error) {
    logError("assistant.conversation_load_failed", error, { userId: request.user.id });
    return apiError("Could not load the conversation", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Conversation ID is invalid");
  try {
    const deleted = await deleteConversation(assistantDb, request.user.id, id);
    if (!deleted) return apiError("Conversation not found", 404);
    return apiNoStoreResponse({ deleted: true });
  } catch (error) {
    logError("assistant.conversation_delete_failed", error, { userId: request.user.id });
    return apiError("Could not delete the conversation", 500);
  }
});
