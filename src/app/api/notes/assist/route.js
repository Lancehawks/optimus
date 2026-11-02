import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { checkRateLimits } from "@/lib/rateLimit";
import { estimateCostUsd } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { AccessError, resolveModelChoice } from "@/lib/assistant/access";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { freeLimitMessage } from "@/lib/assistant/freeLimit";
import { monthlySpendUsd, nextMonthStartUtc, readMonthlyBudgetUsd, recordUsage } from "@/lib/assistant/store";
import {
  NOTE_ASSIST_SYSTEM_PROMPT,
  clipAssistText,
  cleanAssistReply,
  isNoteAssistAction,
  noteAssistPrompt,
} from "@/lib/noteAssist";
import { logError } from "@/lib/logger";

export const maxDuration = 60;

// Writing help in the note editor, on the same terms as the assistant: the
// member's default model, paid by their own key or (if an admin allows it)
// the workspace key, within the monthly budget. Nothing is stored except the
// usage row.
export const POST = withAuth(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  if (!isNoteAssistAction(body.action)) return apiError("Unknown writing action");
  const text = clipAssistText(body.action, typeof body.text === "string" ? body.text : "");
  if (!text) return apiError("Select or write some text first");

  const userId = request.user.id;
  try {
    const rateLimit = await checkRateLimits(request, [
      { scope: "notes:assist:minute", identifier: userId, limit: 10, windowMs: 60 * 1000, perIp: false },
      { scope: "notes:assist:hour", identifier: userId, limit: 60, windowMs: 60 * 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) return apiError("That's a lot of requests at once. Wait a moment and try again.", 429);

    const { model, keySource, apiKey } = await resolveModelChoice(assistantDb, request.user, null, workspaceContext());
    const provider = getProvider(model.provider);
    if (!provider) return apiError("Your default model isn't available. Pick another one in the assistant.", 409);

    const now = new Date();
    if (model.free) {
      const quota = await provider.freeQuota?.(apiKey);
      if (quota && quota.remaining <= 0) return apiError(freeLimitMessage(quota, now), 429);
    }
    if (keySource === "workspace" && await monthlySpendUsd(assistantDb, now) >= readMonthlyBudgetUsd()) {
      const resumes = nextMonthStartUtc(now).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
      return apiError(`The workspace AI key has reached this month's spending limit. It will be back on ${resumes}. You can keep going with your own API key.`, 429);
    }

    const abort = new AbortController();
    request.signal?.addEventListener("abort", () => abort.abort(), { once: true });

    let turn = null;
    try {
      for await (const event of provider.streamTurn({
        model,
        system: NOTE_ASSIST_SYSTEM_PROMPT,
        memory: null,
        tools: [],
        history: [{ kind: "input", content: noteAssistPrompt(body.action, text) }],
        signal: abort.signal,
        apiKey,
      })) {
        if (event.type === "turn") turn = event.turn;
      }
    } catch (error) {
      if (abort.signal.aborted || provider.isAbortError(error)) return apiError("Cancelled", 499);
      logError("notes.assist_failed", error, { userId, model: model.key, keySource });
      const message = provider.describeError?.(error, { ownKey: keySource === "member" });
      return apiError(message || "The model couldn't answer. Try again.", provider.isRateLimitError(error) ? 429 : 502);
    }
    if (!turn) return apiError("The model couldn't answer. Try again.", 502);

    await recordUsage(assistantDb, {
      userId,
      chatId: null,
      model,
      keySource,
      usage: turn.usage,
      costUsd: turn.usage.costUsd ?? estimateCostUsd(model, turn.usage),
    });

    if (turn.stopReason === "refusal") return apiError("The model declined this request.", 422);
    const reply = cleanAssistReply(turn.text);
    if (!reply) return apiError("The model returned nothing. Try again.", 502);
    return apiNoStoreResponse({ text: reply, model: model.label });
  } catch (error) {
    if (error instanceof AccessError) return apiError(error.message, error.status);
    logError("notes.assist_error", error, { userId });
    return apiError("Could not run the writing action", 500);
  }
});
