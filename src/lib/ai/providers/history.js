// A conversation can change models between messages. Each adapter replays the
// responses its own provider produced exactly as stored, and sees responses
// from other models as plain assistant text: their lookups are left out,
// since one provider's tool calls and reasoning can't be replayed to another.
//
// The rendering depends only on the stored rows, so a conversation renders
// the same way on every request (which prompt caches and preserved reasoning
// both rely on).

/**
 * @param history stored rows in order
 * @param isNative (row) => whether this adapter can replay the row verbatim
 * @returns entries: { type: "input", row, answered, last }
 *                   { type: "model", row }    a native response
 *                   { type: "results", row }  native tool results
 *                   { type: "text", text }    responses from other models, merged
 */
export function conversationEntries(history, isNative) {
  const entries = [];
  for (const row of history) {
    if (row.kind === "input") {
      entries.push({ type: "input", row, answered: false, last: false });
    } else if (row.kind === "model") {
      if (isNative(row)) {
        entries.push({ type: "model", row });
      } else if (row.content) {
        const previous = entries.at(-1);
        if (previous?.type === "text") previous.text = `${previous.text}\n\n${row.content}`;
        else entries.push({ type: "text", text: row.content });
      }
    } else if (row.kind === "tool_results" && isNative(row)) {
      entries.push({ type: "results", row });
    }
  }

  // An input counts as answered when an assistant message this adapter can
  // render follows it before the next input.
  let pending = null;
  for (const entry of entries) {
    if (entry.type === "input") pending = entry;
    else if (pending && (entry.type === "model" || entry.type === "text")) pending.answered = true;
  }
  const lastEntry = entries.at(-1);
  if (lastEntry?.type === "input") lastEntry.last = true;
  return entries;
}
