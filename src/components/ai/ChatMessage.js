"use client";

import { cn } from "@/lib/utils";

function parseMarkdown(text) {
  if (!text) return [];

  // Split by fenced code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Fenced code block
    if (part.startsWith("```")) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      const lang = match?.[1] || "";
      const code = match?.[2]?.trimEnd() || part.slice(3, -3).trimEnd();
      return (
        <div key={i} className="relative my-3 group">
          {lang && (
            <div className="text-[0.65rem] text-muted uppercase tracking-wider px-3 pt-2 pb-0 bg-neutral-900 rounded-t-lg">
              {lang}
            </div>
          )}
          <pre className={cn("bg-neutral-900 p-3 overflow-x-auto text-sm leading-relaxed", lang ? "rounded-b-lg" : "rounded-lg")}>
            <code className="text-neutral-200">{code}</code>
          </pre>
        </div>
      );
    }

    // Non-code text — process blocks
    if (!part.trim()) return null;
    return <InlineMarkdown key={i} text={part} />;
  });
}

function InlineMarkdown({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];
  let listType = null; // "ul" or "ol"

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType === "ol" ? "ol" : "ul";
      const cls = listType === "ol" ? "list-decimal" : "list-disc";
      elements.push(
        <Tag key={`list-${elements.length}`} className={cn(cls, "ml-5 my-1.5 space-y-0.5")}>
          {listItems.map((item, j) => (
            <li key={j}>{processInline(item)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const cls = level === 1 ? "text-lg font-bold" : level === 2 ? "text-base font-bold" : "text-sm font-semibold";
      elements.push(
        <div key={i} className={cn(cls, "text-heading mt-3 mb-1.5")}>
          {processInline(headerMatch[2])}
        </div>
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-border my-3" />);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="my-1">
        {processInline(line)}
      </p>
    );
  }

  flushList();
  return <>{elements}</>;
}

function processInline(text) {
  if (!text) return text;

  const tokens = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    if (match) {
      if (match[1]) tokens.push(processInline(match[1]));
      tokens.push(<strong key={key++} className="font-semibold text-heading">{processInline(match[2])}</strong>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic
    match = remaining.match(/^(.*?)\*(.+?)\*/);
    if (match) {
      if (match[1]) tokens.push(processInline(match[1]));
      tokens.push(<em key={key++}>{processInline(match[2])}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code
    match = remaining.match(/^(.*?)`([^`]+)`/);
    if (match) {
      if (match[1]) tokens.push(match[1]);
      tokens.push(
        <code key={key++} className="bg-neutral-800 text-brand-300 px-1.5 py-0.5 rounded text-[0.8em]">
          {match[2]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Links
    match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      if (match[1]) tokens.push(match[1]);
      tokens.push(
        <a key={key++} href={match[3]} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
          {match[2]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // No more matches — push remaining text
    tokens.push(remaining);
    break;
  }

  return tokens.length === 1 ? tokens[0] : tokens;
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[0.65rem] font-bold mt-0.5",
          isUser
            ? "bg-brand-500/15 text-brand-400"
            : "bg-purple-500/15 text-purple-400"
        )}
      >
        {isUser ? "Y" : "AI"}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-2.5 text-[0.875rem] leading-relaxed",
          isUser
            ? "bg-brand-500/10 text-heading"
            : "bg-neutral-800/40 text-body"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <div className="prose-sm">{parseMarkdown(message.content)}</div>
        ) : (
          <span className="inline-block h-4 w-1.5 bg-brand-400 rounded-sm animate-pulse" />
        )}
      </div>
    </div>
  );
}
