"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { syntaxHighlighter } from "@blocknote/code-block";
import "@blocknote/mantine/style.css";
import "./note-editor.css";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Spinner } from "@/components/ui";
import { assistantService, noteService, taskService } from "@/services/api";
import { uploadWorkspaceFile } from "@/lib/uploadClient";
import { inlineText, noteSchema } from "./editor/schema";
import { NoteMenus } from "./editor/NoteMenus";

// A detached editor converts between blocks and HTML. It never mounts, so it
// still works while the visible editor is tearing down and flushing.
let converter = null;
function getConverter() {
  converter ??= BlockNoteEditor.create({ schema: noteSchema });
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

// BlockNote marks empty blocks with U+FFFC so they survive re-parsing. The
// HTML copy only feeds search, previews and the assistant, so drop it.
function blocksToStoredHtml(blocks) {
  return getConverter().blocksToHTMLLossy(blocks).replaceAll("￼", "");
}

// Writing help shows only for members who can use the assistant at all.
let assistAvailability = null;
function loadAssistAvailability() {
  assistAvailability ||= assistantService.listModels()
    .then((data) => (data.models || []).length > 0)
    .catch(() => false);
  return assistAvailability;
}

const ASSIST_STATUS = {
  improve: "Improving the writing",
  fix: "Fixing spelling and grammar",
  shorter: "Shortening",
  summarize: "Summarizing",
  continue: "Writing",
  summarizeNote: "Summarizing the note",
};
const SELECTION_ACTIONS = new Set(["improve", "fix", "shorter", "summarize"]);

const NoteEditor = forwardRef(function NoteEditor({
  content,
  blocks,
  onChange,
  editable = true,
  placeholder = "Start writing, or type / for blocks and @ to link",
  noteId,
  projectId,
  onFirstEdit,
  onNotify,
  children,
}, ref) {
  const { user } = useAuth();
  const { mode } = useTheme();
  const debounceRef = useRef(null);
  const pendingChangeRef = useRef(null);
  const editedRef = useRef(false);
  const contextRef = useRef({});
  const [initialContent] = useState(() => initialBlocksFor(blocks, content));
  const [assistEnabled, setAssistEnabled] = useState(false);
  const [assistStatus, setAssistStatus] = useState(null);

  useEffect(() => {
    contextRef.current = { userId: user?.id, noteId, projectId, onNotify, onFirstEdit };
  });

  useEffect(() => {
    let active = true;
    if (editable) void loadAssistAvailability().then((enabled) => active && setAssistEnabled(enabled));
    return () => {
      active = false;
    };
  }, [editable]);

  const notify = useCallback((message, type = "info") => {
    contextRef.current.onNotify?.({ message, type });
  }, []);

  const editor = useCreateBlockNote({
    schema: noteSchema,
    extensions: [syntaxHighlighter],
    initialContent,
    dictionary: {
      ...en,
      placeholders: { ...en.placeholders, emptyDocument: placeholder },
    },
    // Attachments go to Vercel Blob and are linked through /api/files.
    uploadFile: async (file) => {
      const { userId, noteId: currentNoteId } = contextRef.current;
      try {
        const saved = await uploadWorkspaceFile(file, { userId, purpose: "note", noteId: currentNoteId });
        return saved.url;
      } catch (error) {
        notify(error.message || "The upload failed. Try again.", "error");
        throw error;
      }
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

    const html = blocksToStoredHtml(pending.blocks);
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
    getMarkdown: () => editor.blocksToMarkdownLossy(editor.document),
    getElement: () => editor.domElement,
  }), [discardPendingChange, flushPendingChange, editor]);

  // Auto-save 600ms after the last edit.
  const handleChange = useCallback(() => {
    if (!editable) return;
    if (!editedRef.current) {
      editedRef.current = true;
      contextRef.current.onFirstEdit?.();
    }
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

  // Menus take focus away from the text. Hand it back so writing can carry on,
  // unless the member has moved on to something else meanwhile.
  const refocusEditor = useCallback(() => {
    const active = document.activeElement;
    if (!active || active === document.body || editor.domElement?.contains(active)) editor.focus();
  }, [editor]);

  // Selection actions rewrite the selected text in place; "continue" and
  // "summarize note" add new blocks below the cursor.
  const runAssist = useCallback(async (action) => {
    if (assistStatus) return;
    const anchor = editor.getTextCursorPosition().block;
    const selectedText = SELECTION_ACTIONS.has(action) ? editor.getSelectedText() : "";
    let text = selectedText;
    if (action === "continue") {
      const index = editor.document.findIndex((block) => block.id === anchor.id);
      text = editor.blocksToMarkdownLossy(index >= 0 ? editor.document.slice(0, index + 1) : editor.document);
    } else if (action === "summarizeNote") {
      text = editor.blocksToMarkdownLossy(editor.document);
    }
    if (!text.trim()) {
      notify(SELECTION_ACTIONS.has(action) ? "Select some text first." : "Write something first.", "info");
      return;
    }

    setAssistStatus(ASSIST_STATUS[action]);
    try {
      const { text: reply } = await noteService.assist({ action, text });
      if (SELECTION_ACTIONS.has(action) && editor.getSelectedText() === selectedText) {
        editor.pasteMarkdown(reply);
      } else {
        // New text takes over the empty line the command was typed on, and
        // the cursor follows it so writing can carry on from there.
        const blocks = editor.tryParseMarkdownToBlocks(reply);
        const target = editor.getBlock(anchor.id);
        const placed = target?.type === "paragraph" && !inlineText(target.content).trim()
          ? editor.replaceBlocks([target], blocks).insertedBlocks
          : editor.insertBlocks(blocks, target || editor.document.at(-1), "after");
        const last = placed.at(-1);
        if (last) editor.setTextCursorPosition(last, "end");
        if (SELECTION_ACTIONS.has(action)) notify("The selection changed, so the result was added below it.", "info");
      }
      refocusEditor();
    } catch (error) {
      notify(error.message || "The writing action failed. Try again.", "error");
    } finally {
      setAssistStatus(null);
    }
  }, [assistStatus, editor, notify, refocusEditor]);

  // The block becomes a link to the new task, in the note's project if it has one.
  const createTaskFromBlock = useCallback(async (block, text) => {
    const { projectId: currentProjectId } = contextRef.current;
    try {
      const { task } = await taskService.create({
        title: text.slice(0, 255),
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
      });
      if (editor.getBlock(block.id)) {
        editor.updateBlock(block.id, {
          content: [{ type: "mention", props: { kind: "task", id: task.id, label: task.title } }],
        });
        editor.setTextCursorPosition(block.id, "end");
        refocusEditor();
      }
      notify("Task created", "success");
    } catch (error) {
      notify(error.message || "Could not create the task", "error");
    }
  }, [editor, notify, refocusEditor]);

  // Clicking the empty page below the last block continues writing there.
  const focusEnd = (event) => {
    if (!editable) return;
    event.preventDefault();
    const lastBlock = editor.document.at(-1);
    if (lastBlock) editor.setTextCursorPosition(lastBlock, "end");
    editor.focus();
  };

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto bg-surface scrollbar-thin">
        <div className="note-column mx-auto flex min-h-full max-w-[50rem] flex-col">
          {children}
          <BlockNoteView
            editor={editor}
            editable={editable}
            theme={mode}
            onChange={handleChange}
            className="optimus-note"
            slashMenu={false}
            formattingToolbar={false}
            sideMenu={false}
          >
            {editable && (
              <NoteMenus
                onAssist={runAssist}
                assistEnabled={assistEnabled}
                onCreateTask={createTaskFromBlock}
                noteId={noteId}
              />
            )}
          </BlockNoteView>
          <div aria-hidden="true" onMouseDown={focusEnd} className={editable ? "min-h-32 flex-1 cursor-text" : "min-h-16 flex-1"} />
        </div>
      </div>
      {assistStatus && (
        <div role="status" className="note-assist-status">
          <Spinner size="sm" />
          {assistStatus}…
        </div>
      )}
    </div>
  );
});

NoteEditor.displayName = "NoteEditor";

export default NoteEditor;

// A read-only rendering, used to preview earlier versions.
export function NotePreview({ blocks, content }) {
  const { mode } = useTheme();
  const [initialContent] = useState(() => initialBlocksFor(blocks, content));
  const editor = useCreateBlockNote({ schema: noteSchema, extensions: [syntaxHighlighter], initialContent });
  return (
    <BlockNoteView
      editor={editor}
      editable={false}
      theme={mode}
      className="optimus-note optimus-note-preview"
      slashMenu={false}
      formattingToolbar={false}
      sideMenu={false}
    />
  );
}
