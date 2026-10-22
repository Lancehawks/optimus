import { withAuth, apiError } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { checkRateLimits } from "@/lib/rateLimit";
import { resolveTimeZone } from "@/lib/calendarTime";
import { getModel, modelKey, resolveConfiguredModel } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { answerMessage } from "@/lib/assistant/agent";
import { assistantDb, assistantDisabledResponse } from "@/lib/assistant/server";
import { eventStreamResponse } from "@/lib/assistant/sse";
import { listMemories, memorySnapshot } from "@/lib/assistant/memory";
import {
  MAX_INPUTS_PER_CONVERSATION,
  countInputs,
  createConversation,
  getConversation,
  loadHistory,
  monthlySpendUsd,
  nextMonthStartUtc,
  readMonthlyBudgetUsd,
} from "@/lib/assistant/store";
import { listEventsForRange } from "@/lib/events/eventCollectionService";
import { logError } from "@/lib/logger";

// A reply can take several model calls and lookups.
export const maxDuration = 60;

const MESSAGE_MAX_LENGTH = 4_000;

function configuredModel() {
  try {
    return resolveConfiguredModel();
  } catch (error) {
    logError("assistant.model_misconfigured", error);
    return null;
  }
}

export const POST = withAuth(async (request) => {
  const disabled = assistantDisabledResponse(request.user);
  if (disabled) return disabled;

  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return apiError("Write a message first");
  if (text.length > MESSAGE_MAX_LENGTH) return apiError(`Messages can be at most ${MESSAGE_MAX_LENGTH} characters`);
  const conversationId = body.conversationId ?? null;
  if (conversationId !== null && optionalUuid(conversationId, "Conversation", { allowNull: false }).error) {
    return apiError("Conversation ID is invalid");
  }

  const userId = request.user.id;
  try {
    const rateLimit = await checkRateLimits(request, [
      { scope: "assistant:message:minute", identifier: userId, limit: 8, windowMs: 60 * 1000, perIp: false },
      { scope: "assistant:message:hour", identifier: userId, limit: 40, windowMs: 60 * 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) {
      return apiError("You're sending messages quickly. Wait a moment and try again.", 429);
    }

    const now = new Date();
    if (await monthlySpendUsd(assistantDb, now) >= readMonthlyBudgetUsd()) {
      const resumes = nextMonthStartUtc(now).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
      return apiError(`The assistant has reached this month's spending limit. It will be back on ${resumes}.`, 429);
    }

    let conversation = null;
    let model;
    if (conversationId) {
      conversation = await getConversation(assistantDb, userId, conversationId);
      if (!conversation) return apiError("Conversation not found", 404);
      model = getModel(modelKey(conversation.provider, conversation.model));
      if (!model) {
        return apiError("This conversation used a model that is no longer available. Start a new conversation.", 409);
      }
    } else {
      model = configuredModel();
      if (!model) return apiError("The assistant isn't set up on this server yet.", 503);
    }

    const provider = getProvider(model.provider);
    if (!provider?.isConfigured()) return apiError("The assistant isn't set up on this server yet.", 503);

    let history = [];
    if (conversation) {
      history = await loadHistory(assistantDb, conversation.id);
      if (countInputs(history) >= MAX_INPUTS_PER_CONVERSATION) {
        return apiError("This conversation is full. Start a new one to keep going.", 409);
      }
    } else {
      const memory = memorySnapshot(await listMemories(assistantDb, userId));
      conversation = await createConversation(assistantDb, { userId, title: text, model, memory });
    }

    const abort = new AbortController();
    request.signal?.addEventListener("abort", () => abort.abort(), { once: true });
    const timeZone = resolveTimeZone(request.user.timezone);

    async function* events() {
      yield { type: "conversation", id: conversation.id, title: conversation.title };
      try {
        yield* answerMessage({
          db: assistantDb,
          provider,
          model,
          conversationId: conversation.id,
          memory: conversation.memory,
          history,
          userId,
          timeZone,
          now,
          text,
          signal: abort.signal,
          listEvents: async ({ start, end }) => (await listEventsForRange({ userId, start, end })).events,
          onToolError: (error, tool) => logError("assistant.tool_failed", error, { userId, tool }),
        });
      } catch (error) {
        if (abort.signal.aborted || provider.isAbortError(error)) return;
        logError("assistant.answer_failed", error, { userId, conversationId: conversation.id });
        yield {
          type: "error",
          message: provider.isRateLimitError(error)
            ? "The assistant is busy right now. Try again in a minute."
            : "Something went wrong while answering. Try again.",
        };
      }
    }

    return eventStreamResponse(events(), { onCancel: () => abort.abort() });
  } catch (error) {
    logError("assistant.message_failed", error, { userId });
    return apiError("Could not send the message", 500);
  }
});
