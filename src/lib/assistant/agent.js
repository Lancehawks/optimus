import { dateKey } from "../calendarTime.js";
import { estimateCostUsd } from "../ai/models.js";
import { ASSISTANT_SYSTEM_PROMPT, assistantContextNote, assistantMemoryBlock } from "./prompt.js";
import { appendMessages, recordUsage, removeUnansweredInput } from "./store.js";
import { runTool, toolDefinitions, toolLabel } from "./tools.js";

// One member message, answered by a model that may call read-only tools. The
// loop is provider-neutral: the provider adapter turns stored rows into its
// own request format and reports each response as a neutral turn.

export const MAX_MODEL_CALLS_PER_MESSAGE = 6;
const MAX_TOOL_OUTPUT_CHARS = 40_000;

export const REFUSAL_NOTICE = "I can't help with that request.";
export const CUT_SHORT_NOTICE = "(The reply was cut short.)";
export const EMPTY_NOTICE = "I couldn't put an answer together. Try asking another way.";

function boundedOutput(output) {
  const serialized = JSON.stringify(output ?? null);
  if (serialized.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  return { error: "The result was too large. Ask for a narrower range or fewer items." };
}

function displayText(turn) {
  const text = turn.text.trim();
  if (turn.stopReason === "refusal") return text ? `${text}\n\n${REFUSAL_NOTICE}` : REFUSAL_NOTICE;
  if (turn.stopReason === "max_tokens") return text ? `${text}\n\n${CUT_SHORT_NOTICE}` : CUT_SHORT_NOTICE;
  return text;
}

/**
 * Yields events for the client:
 *   { type: "status", label }  a lookup started
 *   { type: "text", text }     reply text as it streams
 *   { type: "done", reply }    the full reply, as stored
 * Errors propagate to the caller, which decides what the member sees. An
 * error raised before any response was stored comes with
 * `error.nothingStored = true`: the message itself has been removed again,
 * so the member can resend it, for example with another model.
 */
export async function* answerMessage(params) {
  const { db, conversationId } = params;
  const progress = { inputSeq: null, storedResponse: false };
  let finished = false;
  try {
    yield* runConversationTurn(params, progress);
    finished = true;
  } catch (error) {
    if (!progress.storedResponse && error && typeof error === "object") error.nothingStored = true;
    throw error;
  } finally {
    // Also runs when the client goes away mid-reply and the stream is closed.
    if (!finished && !progress.storedResponse && progress.inputSeq !== null) {
      await removeUnansweredInput(db, conversationId, progress.inputSeq).catch(() => {});
    }
  }
}

async function* runConversationTurn({
  db,
  provider,
  model,
  conversationId,
  memory = null,
  history,
  userId,
  timeZone,
  now = new Date(),
  text,
  listEvents,
  signal,
  onToolError,
  apiKey = null,
  keySource = "workspace",
}, progress) {
  const input = { kind: "input", content: text, payload: { context: assistantContextNote(now, timeZone) } };
  [progress.inputSeq] = await appendMessages(db, conversationId, [input]);
  history.push(input);

  const tools = toolDefinitions();
  const memoryBlock = assistantMemoryBlock(memory);
  const toolContext = { db, userId, timeZone, today: dateKey(now, timeZone), listEvents };
  const replyParts = [];
  // Every response records the model that produced it, so a conversation can
  // switch models and each adapter knows which rows it can replay as stored.
  const producedBy = { provider: model.provider, model: model.id };

  for (let call = 1; call <= MAX_MODEL_CALLS_PER_MESSAGE; call += 1) {
    // On the last allowed call the model must answer with what it has.
    const finalStep = call === MAX_MODEL_CALLS_PER_MESSAGE;
    let turn = null;
    let streamedText = false;
    for await (const event of provider.streamTurn({
      model,
      system: ASSISTANT_SYSTEM_PROMPT,
      memory: memoryBlock,
      tools,
      history,
      finalStep,
      signal,
      apiKey,
    })) {
      if (event.type === "text" && event.text) {
        if (!streamedText && replyParts.length > 0) yield { type: "text", text: "\n\n" };
        streamedText = true;
        yield { type: "text", text: event.text };
      } else if (event.type === "turn") {
        turn = event.turn;
      }
    }
    if (!turn) throw new Error("The model stream ended without a response");

    await recordUsage(db, {
      userId,
      chatId: conversationId,
      model,
      keySource,
      usage: turn.usage,
      // Providers that report their actual charge (OpenRouter) beat our estimate.
      costUsd: turn.usage.costUsd ?? estimateCostUsd(model, turn.usage),
    });

    if (turn.stopReason === "tool_calls" && turn.toolCalls.length > 0) {
      for (const toolCall of turn.toolCalls) yield { type: "status", label: toolLabel(toolCall.name) };
      const results = await Promise.all(
        turn.toolCalls.map((toolCall) => runTool(toolContext, toolCall.name, toolCall.input, { onError: onToolError }))
      );
      const modelRow = { kind: "model", ...producedBy, content: turn.text.trim(), payload: turn.payload };
      const resultsRow = {
        kind: "tool_results",
        ...producedBy,
        content: "",
        payload: {
          results: turn.toolCalls.map((toolCall, index) => ({
            id: toolCall.id,
            name: toolCall.name,
            output: boundedOutput(results[index].output),
            isError: results[index].isError,
          })),
        },
      };
      await appendMessages(db, conversationId, [modelRow, resultsRow]);
      progress.storedResponse = true;
      history.push(modelRow, resultsRow);
      if (modelRow.content) replyParts.push(modelRow.content);
      continue;
    }

    const shown = displayText(turn) || EMPTY_NOTICE;
    const modelRow = { kind: "model", ...producedBy, content: shown, payload: turn.payload };
    await appendMessages(db, conversationId, [modelRow]);
    progress.storedResponse = true;
    history.push(modelRow);

    // A notice the model didn't write still reaches the member's screen.
    const notice = shown.slice(turn.text.trim().length).trim();
    if (notice) yield { type: "text", text: streamedText || replyParts.length > 0 ? `\n\n${notice}` : notice };

    replyParts.push(shown);
    yield { type: "done", reply: replyParts.join("\n\n") };
    return;
  }

  // Reached only when a model that can't be told to stop calling tools
  // (no tool_choice support) keeps calling them on its last allowed turn.
  yield { type: "text", text: EMPTY_NOTICE };
  yield { type: "done", reply: EMPTY_NOTICE };
}
