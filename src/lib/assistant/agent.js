import { dateKey } from "../calendarTime.js";
import { estimateCostUsd } from "../ai/models.js";
import { ASSISTANT_SYSTEM_PROMPT, assistantContextNote } from "./prompt.js";
import { appendMessages, recordUsage } from "./store.js";
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
 * Errors propagate to the caller, which decides what the member sees.
 */
export async function* answerMessage({
  db,
  provider,
  model,
  conversationId,
  history,
  userId,
  timeZone,
  now = new Date(),
  text,
  listEvents,
  signal,
  onToolError,
}) {
  const input = { kind: "input", content: text, payload: { context: assistantContextNote(now, timeZone) } };
  await appendMessages(db, conversationId, [input]);
  history.push(input);

  const tools = toolDefinitions();
  const toolContext = { db, userId, timeZone, today: dateKey(now, timeZone), listEvents };
  const replyParts = [];

  for (let call = 1; call <= MAX_MODEL_CALLS_PER_MESSAGE; call += 1) {
    // On the last allowed call the model must answer with what it has.
    const finalStep = call === MAX_MODEL_CALLS_PER_MESSAGE;
    let turn = null;
    let streamedText = false;
    for await (const event of provider.streamTurn({
      model,
      system: ASSISTANT_SYSTEM_PROMPT,
      tools,
      history,
      finalStep,
      signal,
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
      usage: turn.usage,
      costUsd: estimateCostUsd(model, turn.usage),
    });

    if (turn.stopReason === "tool_calls" && turn.toolCalls.length > 0) {
      for (const toolCall of turn.toolCalls) yield { type: "status", label: toolLabel(toolCall.name) };
      const results = await Promise.all(
        turn.toolCalls.map((toolCall) => runTool(toolContext, toolCall.name, toolCall.input, { onError: onToolError }))
      );
      const modelRow = { kind: "model", content: turn.text.trim(), payload: turn.payload };
      const resultsRow = {
        kind: "tool_results",
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
      history.push(modelRow, resultsRow);
      if (modelRow.content) replyParts.push(modelRow.content);
      continue;
    }

    const shown = displayText(turn) || EMPTY_NOTICE;
    const modelRow = { kind: "model", content: shown, payload: turn.payload };
    await appendMessages(db, conversationId, [modelRow]);
    history.push(modelRow);

    // A notice the model didn't write still reaches the member's screen.
    const notice = shown.slice(turn.text.trim().length).trim();
    if (notice) yield { type: "text", text: streamedText || replyParts.length > 0 ? `\n\n${notice}` : notice };

    replyParts.push(shown);
    yield { type: "done", reply: replyParts.join("\n\n") };
    return;
  }

  // Unreachable while the final call disallows tools; kept as a backstop.
  yield { type: "text", text: EMPTY_NOTICE };
  yield { type: "done", reply: EMPTY_NOTICE };
}
