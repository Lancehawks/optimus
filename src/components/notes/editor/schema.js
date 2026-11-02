"use client";

import Link from "next/link";
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import { createReactInlineContentSpec } from "@blocknote/react";
import { codeBlockOptions } from "@blocknote/code-block";
import { FileText, FolderKanban, SquareCheck } from "lucide-react";

export const MENTION_KINDS = {
  task: { label: "Task", Icon: SquareCheck, href: (id) => `/tasks?task_id=${id}` },
  project: { label: "Project", Icon: FolderKanban, href: (id) => `/projects?project_id=${id}` },
  note: { label: "Note", Icon: FileText, href: (id) => `/notes?note_id=${id}` },
};

export function mentionHref(kind, id) {
  return (MENTION_KINDS[kind] || MENTION_KINDS.note).href(encodeURIComponent(id));
}

function MentionChip({ kind, id, label }) {
  const { Icon } = MENTION_KINDS[kind] || MENTION_KINDS.note;
  return (
    <Link href={mentionHref(kind, id)} prefetch={false} className="note-mention" data-mention-kind={kind}>
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}

// A link to a task, project or note in the workspace, inserted with "@".
// Exported HTML is a plain link, which parses back into a mention.
const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      kind: { default: "note", values: ["task", "project", "note"] },
      id: { default: "" },
      label: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => <MentionChip {...inlineContent.props} />,
    toExternalHTML: ({ inlineContent }) => {
      const { kind, id, label } = inlineContent.props;
      return (
        <a href={mentionHref(kind, id)} data-mention-kind={kind} data-mention-id={id}>
          @{label}
        </a>
      );
    },
    parse: (element) => {
      const { mentionKind: kind, mentionId: id } = element.dataset || {};
      if (element.tagName !== "A" || !MENTION_KINDS[kind] || !id) return undefined;
      return { kind, id, label: element.textContent.replace(/^@/, "") };
    },
  }
);

// H1–H3 only, matching the studio type scale, and syntax-highlighted code.
export const noteSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3] }),
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
});

// Plain text of a block's inline content, mentions included.
export function inlineText(content) {
  if (!Array.isArray(content)) return "";
  return content.map((item) => {
    if (item.type === "text") return item.text;
    if (item.type === "link") return inlineText(item.content);
    if (item.type === "mention") return item.props.label;
    return "";
  }).join("");
}
