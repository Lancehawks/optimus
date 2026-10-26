// One-shot writing help inside the note editor. Each action turns the
// member's text into a single request; the reply is Markdown that the editor
// pastes in place of the selection or below the cursor.

export const NOTE_ASSIST_TEXT_MAX = 12_000;

export const NOTE_ASSIST_SYSTEM_PROMPT = `You are a writing assistant inside Optimus, a private workspace where a member keeps notes. You edit or extend the member's text as asked.

Reply with the resulting text only, in Markdown: no preamble, no explanation, no surrounding quotes or code fences. Keep the member's language, voice and meaning. Keep Markdown structure (headings, lists, checklists, links) where the original has it. Never invent facts, names, numbers or dates that aren't in the text.`;

export const NOTE_ASSIST_ACTIONS = {
  improve: {
    label: "Improve writing",
    instruction: "Rewrite the following text so it reads more clearly and smoothly. Keep its meaning and roughly its length.",
  },
  shorter: {
    label: "Make shorter",
    instruction: "Rewrite the following text to be noticeably shorter, keeping every important point.",
  },
  fix: {
    label: "Fix spelling and grammar",
    instruction: "Correct the spelling, grammar and punctuation of the following text. Change nothing else.",
  },
  summarize: {
    label: "Summarize",
    instruction: "Summarize the following text in a few short bullet points.",
  },
  continue: {
    label: "Continue writing",
    instruction: "Continue writing from where the following text ends, in the same style, for one or two short paragraphs. Reply with only the new text, not the text you were given.",
  },
  summarizeNote: {
    label: "Summarize note",
    instruction: "Write a short summary of the following note: a one-sentence overview, then the key points and any action items as bullet points. Start with a level-3 heading \"Summary\".",
  },
};

export function isNoteAssistAction(value) {
  return Object.hasOwn(NOTE_ASSIST_ACTIONS, value);
}

// Continuing needs the end of the text; everything else needs all of it.
export function clipAssistText(action, text) {
  const clean = String(text || "").trim();
  if (clean.length <= NOTE_ASSIST_TEXT_MAX) return clean;
  return action === "continue" ? clean.slice(-NOTE_ASSIST_TEXT_MAX) : clean.slice(0, NOTE_ASSIST_TEXT_MAX);
}

export function noteAssistPrompt(action, text) {
  return `${NOTE_ASSIST_ACTIONS[action].instruction}\n\n<text>\n${text}\n</text>`;
}

// Models sometimes wrap the whole reply in a code fence anyway.
export function cleanAssistReply(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}
