"use client";

import Link from "next/link";

// Renders the small Markdown subset the assistant is asked to write:
// paragraphs, "-" and numbered lists, **bold**, `code` and links. It builds
// React elements and never injects HTML. Only in-app paths become links;
// anything else is shown as plain text.

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+/;

function isInternalPath(href) {
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

function renderInline(text, keyPrefix, onNavigate) {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key} className="font-semibold text-heading">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key} className="rounded bg-surface-tertiary px-1 font-mono text-sm">{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (!isInternalPath(href)) return <span key={key}>{label}</span>;
      return (
        <Link
          key={key}
          href={href}
          onClick={onNavigate}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        >
          {label}
        </Link>
      );
    }
    return <span key={key}>{part.replace(/^#{1,6}\s+/, "")}</span>;
  });
}

function renderLines(lines, keyPrefix, onNavigate) {
  return lines.flatMap((line, index) => {
    const content = renderInline(line, `${keyPrefix}-${index}`, onNavigate);
    return index === 0 ? content : [<br key={`${keyPrefix}-br-${index}`} />, ...content];
  });
}

export default function AssistantMarkdown({ text, onNavigate }) {
  const blocks = String(text || "").trim().split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-sm leading-6 text-body">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return null;
        const key = `b${blockIndex}`;
        const listStart = lines.findIndex((line) => LIST_ITEM.test(line));
        if (listStart >= 0 && lines.slice(listStart).every((line) => LIST_ITEM.test(line))) {
          const items = lines.slice(listStart);
          const ordered = items.every((line) => ORDERED_ITEM.test(line));
          const ListTag = ordered ? "ol" : "ul";
          return (
            <div key={key} className="space-y-1.5">
              {listStart > 0 && <p>{renderLines(lines.slice(0, listStart), `${key}-lead`, onNavigate)}</p>}
              <ListTag className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5 marker:text-muted"}>
                {items.map((line, index) => (
                  <li key={`${key}-${index}`}>{renderInline(line.replace(LIST_ITEM, ""), `${key}-${index}`, onNavigate)}</li>
                ))}
              </ListTag>
            </div>
          );
        }
        return <p key={key}>{renderLines(lines, key, onNavigate)}</p>;
      })}
    </div>
  );
}
