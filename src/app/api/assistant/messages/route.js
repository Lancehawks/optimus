import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { checkRateLimits } from "@/lib/rateLimit";
import { resolveTimeZone } from "@/lib/calendarTime";
import { modelKey } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { AccessError, resolveModelChoice } from "@/lib/assistant/access";
import { answerMessage } from "@/lib/assistant/agent";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { eventStreamResponse } from "@/lib/assistant/sse";
import { freeLimitMessage } from "@/lib/assistant/freeLimit";
import { listMemories, memorySnapshot } from "@/lib/assistant/memory";
import {
  MAX_INPUTS_PER_CONVERSATION,
  countInputs,
  createConversation,
  deleteConversation,
  getConversation,
  isConversationEmpty,
  loadHistory,
  monthlySpendUsd,
  nextMonthStartUtc,
  readMonthlyBudgetUsd,
  rememberModelChoice,
  setConversationModel,
} from "@/lib/assistant/store";
import { listEventsForRange } from "@/lib/events/eventCollectionService";
import { logError } from "@/lib/logger";

// A reply can take several model calls and lookups.
export const maxDuration = 60;

const MESSAGE_MAX_LENGTH = 4_000;

export const POST = withAuth(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return apiError("Write a message first");
  if (text.length > MESSAGE_MAX_LENGTH) return apiError(`Messages can be at most ${MESSAGE_MAX_LENGTH} characters`);
  const conversationId = body.conversationId ?? null;
  if (conversationId !== null && optionalUuid(conversationId, "Conversation", { allowNull: false }).error) {
    return apiError("Conversation ID is invalid");
  }
  if (body.model !== undefined && body.model !== null && (typeof body.model !== "string" || body.model.length > 200)) {
    return apiError("Model is invalid");
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

    let conversation = null;
    if (conversationId) {
      conversation = await getConversation(assistantDb, userId, conversationId);
      if (!conversation) return apiError("Conversation not found", 404);
    }

    // The picker's choice, else the conversation's current model, else the
    // member's default. A conversation can change models between messages.
    const requested = body.model || (conversation ? modelKey(conversation.provider, conversation.model) : null);
    const { model, keySource, apiKey } = await resolveModelChoice(assistantDb, request.user, requested, workspaceContext());
    const provider = getProvider(model.provider);
    if (!provider) return apiError("That model isn't available. Pick another one.", 409);

    const now = new Date();
    // Free models: stop before saving anything when today's allowance is used up.
    if (model.free) {
      const quota = await provider.freeQuota?.(apiKey);
      if (quota && quota.remaining <= 0) {
        return apiNoStoreResponse({ error: freeLimitMessage(quota, now), code: "free_daily_limit" }, 429);
      }
    }
    if (keySource === "workspace" && await monthlySpendUsd(assistantDb, now) >= readMonthlyBudgetUsd()) {
      const resumes = nextMonthStartUtc(now).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
      return apiError(`The workspace AI key has reached this month's spending limit. It will be back on ${resumes}. You can keep going with your own API key.`, 429);
    }

    let history = [];
    const createdNow = !conversation;
    if (conversation) {
      history = await loadHistory(assistantDb, conversation.id);
      if (countInputs(history) >= MAX_INPUTS_PER_CONVERSATION) {
        return apiError("This conversation is full. Start a new one to keep going.", 409);
      }
      if (conversation.provider !== model.provider || conversation.model !== model.id) {
        await setConversationModel(assistantDb, conversation.id, model);
      }
    } else {
      const memory = memorySnapshot(await listMemories(assistantDb, userId));
      conversation = await createConversation(assistantDb, { userId, title: text, model, memory });
    }
    await rememberModelChoice(assistantDb, userId, model.key);

    const abort = new AbortController();
    request.signal?.addEventListener("abort", () => abort.abort(), { once: true });
    const timeZone = resolveTimeZone(request.user.timezone);

    // A new conversation whose first message failed before any reply is
    // removed again, so it doesn't linger empty in the history list.
    const discardIfEmpty = async () => {
      if (!createdNow || !(await isConversationEmpty(assistantDb, conversation.id))) return false;
      return deleteConversation(assistantDb, userId, conversation.id);
    };

    async function* events() {
      yield { type: "conversation", id: conversation.id, title: conversation.title, model: model.key, modelLabel: model.label };
      try {
        yield* answerMessage({
          db: assistantDb,
          provider,
          model,
          apiKey,
          keySource,
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
        const nothingStored = Boolean(error?.nothingStored);
        const conversationRemoved = nothingStored ? await discardIfEmpty().catch(() => false) : false;
        if (abort.signal.aborted || provider.isAbortError(error)) return;
        logError("assistant.answer_failed", error, { userId, conversationId: conversation.id, model: model.key, keySource });

        let code = null;
        let message = provider.describeError?.(error, { ownKey: keySource === "member" });
        if (provider.isRateLimitError(error)) {
          code = "rate_limited";
          // A free model's 429 is often the daily allowance running out mid-answer.
          if (model.free) {
            const quota = await provider.freeQuota?.(apiKey);
            if (quota && quota.remaining <= 0) {
              code = "free_daily_limit";
              message = freeLimitMessage(quota);
            }
          }
        }
        yield {
          type: "error",
          message: message || "Something went wrong while answering. Try again.",
          code,
          // The message was removed again; the panel puts it back in the box.
          restoreDraft: nothingStored,
          conversationRemoved,
        };
      }
    }

    return eventStreamResponse(events(), { onCancel: () => abort.abort() });
  } catch (error) {
    if (error instanceof AccessError) return apiError(error.message, error.status);
    logError("assistant.message_failed", error, { userId });
    return apiError("Could not send the message", 500);
  }
});
