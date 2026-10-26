"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "./note-editor.css";
import { useTheme } from "@/context/ThemeContext";

// A detached editor converts between blocks and HTML. It never mounts, so it
// still works while the visible editor is tearing down and flushing.
let converter = null;
function getConverter() {
  converter ??= BlockNoteEditor.create();
  return converter;
}

// Notes written before BlockNote use TipTap markup for checklists and
// highlights. Rewrite those into the shapes BlockNote parses.
function toBlockNoteHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll('li[data-type="taskItem"]').forEach((item) => {
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    if (item.getAttribute("data-checked") === "true") checkbox.setAttribute("checked", "");
    item.querySelector(":scope > label")?.remove();
    const body = item.querySelector(":scope > div");
    if (body) body.replaceWith(...body.childNodes);
    item.prepend(checkbox);
  });

  doc.querySelectorAll("mark").forEach((mark) => {
    const span = doc.createElement("span");
    span.setAttribute("data-style-type", "backgroundColor");
    span.setAttribute("data-value", "yellow");
    span.append(...mark.childNodes);
    mark.replaceWith(span);
  });

  return doc.body.innerHTML;
}

function initialBlocksFor(blocks, html) {
  if (Array.isArray(blocks) && blocks.length > 0) return blocks;
  if (!html) return undefined;
  const parsed = getConverter().tryParseHTMLToBlocks(toBlockNoteHtml(html));
  return parsed.length > 0 ? parsed : undefined;
}

const NoteEditor = forwardRef(function NoteEditor({
  content,
  blocks,
  onChange,
  editable = true,
  placeholder = "Start writing, or type / for blocks",
  children,
}, ref) {
  const { mode } = useTheme();
  const debounceRef = useRef(null);
  const pendingChangeRef = useRef(null);
  const [initialContent] = useState(() => initialBlocksFor(blocks, content));

  const editor = useCreateBlockNote({
    initialContent,
    dictionary: {
      ...en,
      placeholders: { ...en.placeholders, emptyDocument: placeholder },
    },
  });

  const discardPendingChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    pendingChangeRef.current = null;
  }, []);

  const flushPendingChange = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;

    const pending = pendingChangeRef.current;
    pendingChangeRef.current = null;
    if (!pending) return null;

    // BlockNote marks empty blocks with U+FFFC so they survive re-parsing. The
    // HTML copy only feeds search, previews and the assistant, so drop it.
    const html = getConverter().blocksToHTMLLossy(pending.blocks).replaceAll("￼", "");
    return pending.onChange?.({ content: html, contentBlocks: pending.blocks });
  }, []);

  useImperativeHandle(ref, () => ({
    discard: discardPendingChange,
    flush: flushPendingChange,
    focus: () => {
      const [firstBlock] = editor.document;
      if (firstBlock) editor.setTextCursorPosition(firstBlock, "start");
      editor.focus();
    },
  }), [discardPendingChange, flushPendingChange, editor]);

  // Auto-save 600ms after the last edit.
  const handleChange = useCallback(() => {
    if (!editable) return;
    pendingChangeRef.current = { blocks: editor.document, onChange };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flushPendingChange().catch((error) => {
        console.error("Note auto-save failed:", error);
      });
    }, 600);
  }, [editable, editor, onChange, flushPendingChange]);

  // Flush the latest edit when switching notes, navigating away, or hiding the page.
  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!pendingChangeRef.current) return;
      event.preventDefault();
      event.returnValue = "";
      void flushPendingChange().catch((error) => {
        console.error("Note auto-save flush failed:", error);
      });
    };
    const flushOnPageHide = () => {
      void flushPendingChange().catch((error) => {
        console.error("Note auto-save flush failed:", error);
      });
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("pagehide", flushOnPageHide);
      flushOnPageHide();
    };
  }, [flushPendingChange]);

  // Clicking the empty page below the last block continues writing there.
  const focusEnd = (event) => {
    if (!editable) return;
    event.preventDefault();
    const lastBlock = editor.document.at(-1);
    if (lastBlock) editor.setTextCursorPosition(lastBlock, "end");
    editor.focus();
  };

  return (
    <div className="h-full overflow-y-auto bg-surface scrollbar-thin">
      <div className="note-column mx-auto flex min-h-full max-w-[50rem] flex-col">
        {children}
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={mode}
          onChange={handleChange}
          className="optimus-note"
        />
        <div aria-hidden="true" onMouseDown={focusEnd} className={editable ? "min-h-32 flex-1 cursor-text" : "min-h-16 flex-1"} />
      </div>
    </div>
  );
});

NoteEditor.displayName = "NoteEditor";

export default NoteEditor;
