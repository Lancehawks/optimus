// Turns the plain text the assistant writes into a note's two stored forms:
// BlockNote blocks for the editor, and the HTML copy that search, previews and
// the assistant read. Supports lines starting "#", "-", "- [ ]" and "1.", and
// **bold**. Everything else is literal text, and all of it is escaped.

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function classifyLine(line) {
  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) return { type: "heading", props: { level: heading[1].length }, text: heading[2] };
  const check = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
  if (check) return { type: "checkListItem", props: { checked: check[1] !== " " }, text: check[2] };
  const bullet = line.match(/^[-*•]\s+(.+)$/);
  if (bullet) return { type: "bulletListItem", props: {}, text: bullet[1] };
  const numbered = line.match(/^\d+[.)]\s+(.+)$/);
  if (numbered) return { type: "numberedListItem", props: {}, text: numbered[1] };
  return { type: "paragraph", props: {}, text: line };
}

// [{ text, bold }] with the ** markers removed.
function inlineRuns(text) {
  return text
    .split(/\*\*([^*\n]+)\*\*/)
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((run) => run.text);
}

function blockFor(item, id) {
  return {
    id,
    type: item.type,
    props: item.props,
    content: inlineRuns(item.text).map((run) => ({ type: "text", text: run.text, styles: run.bold ? { bold: true } : {} })),
    children: [],
  };
}

function inlineHtml(text) {
  return inlineRuns(text)
    .map((run) => (run.bold ? `<strong>${escapeHtml(run.text)}</strong>` : escapeHtml(run.text)))
    .join("");
}

const LIST_TAGS = { bulletListItem: "ul", checkListItem: "ul", numberedListItem: "ol" };

function htmlFor(items) {
  let html = "";
  let openList = null;
  for (const item of items) {
    const listTag = LIST_TAGS[item.type] || null;
    if (openList && openList !== listTag) html += `</${openList}>`;
    if (listTag && openList !== listTag) html += `<${listTag}>`;
    openList = listTag;

    const inner = inlineHtml(item.text);
    if (item.type === "heading") html += `<h${item.props.level}>${inner}</h${item.props.level}>`;
    else if (item.type === "checkListItem") html += `<li><input type="checkbox"${item.props.checked ? " checked" : ""}>${inner}</li>`;
    else if (listTag) html += `<li>${inner}</li>`;
    else html += `<p>${inner}</p>`;
  }
  if (openList) html += `</${openList}>`;
  return html;
}

export function textToNote(text, newId = () => globalThis.crypto.randomUUID()) {
  const items = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(classifyLine);
  return { html: htmlFor(items), blocks: items.map((item) => blockFor(item, newId())) };
}

// The editor keeps an empty paragraph at the end of a document; new text goes
// where that paragraph is rather than after a gap.
export function withoutTrailingBlanks(blocks) {
  const kept = [...blocks];
  while (kept.length > 0) {
    const last = kept.at(-1);
    const empty = last?.type === "paragraph"
      && (!last.content || last.content.length === 0)
      && (!last.children || last.children.length === 0);
    if (!empty) break;
    kept.pop();
  }
  return kept;
}
