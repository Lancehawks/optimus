"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Mark } from "@tiptap/core";
import {
  Bold,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Custom FontSize mark (no extra package needed) ────────────
const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attributes) =>
          attributes.size ? { style: `font-size: ${attributes.size}` } : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (el) =>
          el.style.fontSize ? { size: el.style.fontSize } : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

// ── Slash command definitions ─────────────────────────────────
const SLASH_COMMANDS = [
  {
    id: "h1",
    label: "Heading 1",
    desc: "Large section heading",
    icon: "H1",
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    desc: "Medium section heading",
    icon: "H2",
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    desc: "Small section heading",
    icon: "H3",
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Bullet List",
    desc: "Unordered list",
    icon: "•",
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Numbered List",
    desc: "Ordered list",
    icon: "1.",
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "Task List",
    desc: "Checkable to-do items",
    icon: "[ ]",
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "code",
    label: "Code Block",
    desc: "Monospaced code block",
    icon: "</>",
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "quote",
    label: "Quote",
    desc: "Block quotation",
    icon: "“”",
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "hr",
    label: "Divider",
    desc: "Horizontal rule",
    icon: "—",
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

// ── Font size options ─────────────────────────────────────────
const FONT_SIZES = [
  { label: "Small", size: "0.8em" },
  { label: "Normal", size: null },
  { label: "Large", size: "1.2em" },
  { label: "Huge", size: "1.6em" },
];

// ── Toolbar button ────────────────────────────────────────────
function TBtn({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        "flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-md px-1 transition-colors [&_svg]:h-[0.9375rem] [&_svg]:w-[0.9375rem]",
        isActive ? "bg-surface-tertiary text-heading" : "text-muted hover:bg-surface-tertiary hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}

function TDiv() {
  return <div className="mx-1 h-4 w-px shrink-0 bg-border" />;
}

// The selection menu is an inverted chip in both themes.
function BBtn({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
        isActive ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────
const NoteEditor = forwardRef(function NoteEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Start writing, or type / for blocks",
  children,
}, ref) {
  const debounceRef = useRef(null);
  const pendingChangeRef = useRef(null);
  const containerRef = useRef(null);
  const slashMenuRef = useRef(null);
  const linkBtnRef = useRef(null);
  const linkInputRef = useRef(null);
  const fontMenuRef = useRef(null);
  const fontBtnRef = useRef(null);

  const [linkPopover, setLinkPopover] = useState({
    open: false,
    url: "",
    top: 0,
    left: 0,
  });
  const [slashMenu, setSlashMenu] = useState({
    open: false,
    query: "",
    top: 0,
    left: 0,
    selected: 0,
  });
  const [fontMenu, setFontMenu] = useState({
    open: false,
    top: 0,
    left: 0,
  });
  const [bubbleMenu, setBubbleMenu] = useState({
    visible: false,
    top: 0,
    left: 0,
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

    return pending.onChange?.(pending.content);
  }, []);

  const editorInstanceRef = useRef(null);
  useImperativeHandle(ref, () => ({
    discard: discardPendingChange,
    flush: flushPendingChange,
    focus: () => editorInstanceRef.current?.commands.focus("start"),
  }), [discardPendingChange, flushPendingChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      FontSize,
    ],
    immediatelyRender: false,
    editable,
    content: content || "",
    onUpdate: ({ editor }) => {
      if (!editable) return;
      // Auto-save (600ms debounce — snappier than 1500ms)
      pendingChangeRef.current = { content: editor.getHTML(), onChange };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushPendingChange().catch((error) => {
          console.error("Note auto-save failed:", error);
        });
      }, 600);

      // Slash command detection
      const { state, view } = editor;
      const { $anchor } = state.selection;
      const text = $anchor.parent.textContent;
      if (text.startsWith("/") && $anchor.parentOffset >= 1) {
        const coords = view.coordsAtPos(state.selection.from);
        const rect = containerRef.current?.getBoundingClientRect() ?? {
          top: 0,
          left: 0,
        };
        setSlashMenu({
          open: true,
          query: text.slice(1).toLowerCase(),
          top: coords.bottom - rect.top + 6,
          left: Math.max(8, coords.left - rect.left),
          selected: 0,
        });
      } else {
        setSlashMenu((m) => (m.open ? { ...m, open: false } : m));
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (!editable) {
        setBubbleMenu((menu) => (menu.visible ? { ...menu, visible: false } : menu));
        return;
      }
      const { state, view } = editor;
      const { empty, from, to } = state.selection;
      if (!empty && from !== to) {
        const startCoords = view.coordsAtPos(from);
        const endCoords = view.coordsAtPos(to);
        const rect = containerRef.current?.getBoundingClientRect() ?? { top: 0, left: 0 };
        const midX = (startCoords.left + endCoords.right) / 2 - rect.left;
        const topY = startCoords.top - rect.top - 8;
        setBubbleMenu({ visible: true, top: Math.max(4, topY), left: midX });
      } else {
        setBubbleMenu((m) => (m.visible ? { ...m, visible: false } : m));
      }
    },
    editorProps: {
      attributes: {
        class:
          "note-prose focus:outline-none min-h-[400px] px-6 pb-24 pt-2 sm:px-10 max-w-[44rem] mx-auto",
      },
    },
  });

  useEffect(() => {
    editorInstanceRef.current = editor;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(editable);
    if (!editable) {
      setSlashMenu((menu) => ({ ...menu, open: false }));
      setFontMenu((menu) => ({ ...menu, open: false }));
      setLinkPopover((popover) => ({ ...popover, open: false }));
      setBubbleMenu((menu) => ({ ...menu, visible: false }));
    }
  }, [editor, editable]);

  // Sync external content
  useEffect(() => {
    if (editor && content !== undefined && !pendingChangeRef.current && editor.getHTML() !== content) {
      editor.commands.setContent(content || "", { emitUpdate: false });
    }
  }, [content, editor]);

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

  // Close slash menu on outside click
  useEffect(() => {
    if (!slashMenu.open) return;
    const handler = (e) => {
      if (!slashMenuRef.current?.contains(e.target))
        setSlashMenu((m) => ({ ...m, open: false }));
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [slashMenu.open]);

  // Slash menu keyboard navigation
  const filteredSlashCmds = SLASH_COMMANDS.filter(
    (c) =>
      !slashMenu.query || c.label.toLowerCase().includes(slashMenu.query)
  );

  const applySlashCommand = useCallback(
    (command) => {
      if (!editor) return;
      const { $anchor } = editor.state.selection;
      const from = $anchor.pos - $anchor.parentOffset;
      const to = $anchor.pos;
      editor.chain().focus().deleteRange({ from, to }).run();
      command.action(editor);
      setSlashMenu((m) => ({ ...m, open: false }));
    },
    [editor]
  );

  useEffect(() => {
    if (!slashMenu.open || !editor) return;
    const handler = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((m) => ({
          ...m,
          selected: Math.min(m.selected + 1, filteredSlashCmds.length - 1),
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((m) => ({
          ...m,
          selected: Math.max(m.selected - 1, 0),
        }));
      } else if (e.key === "Enter" && filteredSlashCmds[slashMenu.selected]) {
        e.preventDefault();
        applySlashCommand(filteredSlashCmds[slashMenu.selected]);
      } else if (e.key === "Escape") {
        setSlashMenu((m) => ({ ...m, open: false }));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [applySlashCommand, editor, filteredSlashCmds, slashMenu.open, slashMenu.selected, slashMenu.query]);

  // Close font menu on outside click
  useEffect(() => {
    if (!fontMenu.open) return;
    const handler = (e) => {
      if (!fontMenuRef.current?.contains(e.target) && !fontBtnRef.current?.contains(e.target))
        setFontMenu((m) => ({ ...m, open: false }));
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fontMenu.open]);

  // Close link popover on outside click
  useEffect(() => {
    if (!linkPopover.open) return;
    const handler = (e) => {
      if (!linkInputRef.current?.closest("[data-link-popover]")?.contains(e.target) &&
          !linkBtnRef.current?.contains(e.target)) {
        setLinkPopover((p) => ({ ...p, open: false }));
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [linkPopover.open]);

  const openLinkPopover = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href || "";
    const btnRect = linkBtnRef.current?.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    setLinkPopover({
      open: true,
      url: existing,
      top: btnRect && containerRect ? btnRect.bottom - containerRect.top + 4 : 40,
      left: btnRect && containerRect ? btnRect.left - containerRect.left : 0,
    });
    setTimeout(() => linkInputRef.current?.focus(), 30);
  };

  const applyLink = () => {
    if (!editor) return;
    if (linkPopover.url.trim()) {
      editor.chain().focus().setLink({ href: linkPopover.url.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkPopover((p) => ({ ...p, open: false }));
  };

  const openFontMenu = () => {
    const btnRect = fontBtnRef.current?.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    setFontMenu({
      open: !fontMenu.open,
      top: btnRect && containerRect ? btnRect.bottom - containerRect.top + 4 : 40,
      left: btnRect && containerRect ? btnRect.left - containerRect.left : 0,
    });
  };

  const applyFontSize = (size) => {
    if (!editor) return;
    if (size === null) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(size).run();
    }
    setFontMenu((m) => ({ ...m, open: false }));
  };

  if (!editor) return null;

  const activeFontSize = editor.getAttributes("fontSize").size || null;
  const activeFontLabel =
    FONT_SIZES.find((f) => f.size === activeFontSize)?.label || "Normal";

  return (
    <div className="relative flex h-full flex-col bg-surface" ref={containerRef}>
      {editable && (
        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-3 py-1.5 scrollbar-none sm:px-6">
          <button
            ref={fontBtnRef}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              openFontMenu();
            }}
            className="flex h-7 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium text-body transition-colors hover:bg-surface-tertiary hover:text-heading"
          >
            {activeFontLabel}
            <ChevronDown className="h-3 w-3 text-muted" />
          </button>

          <TDiv />
          <TBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (⌘B)"><Bold /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (⌘I)"><Italic /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline (⌘U)"><UnderlineIcon /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough"><Strikethrough /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight"><Highlighter /></TBtn>

          <TDiv />
          <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1"><Heading1 /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2"><Heading2 /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3"><Heading3 /></TBtn>

          <TDiv />
          <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list"><List /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered list"><ListOrdered /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} title="Task list"><ListTodo /></TBtn>

          <TDiv />
          <button
            ref={linkBtnRef}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              openLinkPopover();
            }}
            title="Insert link (⌘K)"
            aria-label="Insert link"
            className={cn(
              "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors",
              editor.isActive("link") ? "bg-surface-tertiary text-heading" : "text-muted hover:bg-surface-tertiary hover:text-heading"
            )}
          >
            <LinkIcon className="h-[0.9375rem] w-[0.9375rem]" />
          </button>
          <TBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code block"><Code2 /></TBtn>
          <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote"><Quote /></TBtn>

          <div className="ml-auto flex items-center pl-2">
            <TBtn onClick={() => editor.chain().focus().undo().run()} isActive={false} title="Undo (⌘Z)"><Undo2 /></TBtn>
            <TBtn onClick={() => editor.chain().focus().redo().run()} isActive={false} title="Redo (⌘⇧Z)"><Redo2 /></TBtn>
          </div>
        </div>
      )}

      {editable && bubbleMenu.visible && (
        <div
          style={{ top: bubbleMenu.top, left: bubbleMenu.left, transform: "translate(-50%, -100%)" }}
          className="pointer-events-auto absolute z-50"
        >
          <div className="flex items-center gap-0.5 rounded-lg bg-[#1f1e1c] p-1 shadow-lg ring-1 ring-white/10">
            <BBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold"><Bold /></BBtn>
            <BBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic"><Italic /></BBtn>
            <BBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline"><UnderlineIcon /></BBtn>
            <BBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough"><Strikethrough /></BBtn>
            <BBtn onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight"><Highlighter /></BBtn>
            <div className="mx-0.5 h-4 w-px bg-white/15" />
            <BBtn onClick={openLinkPopover} isActive={editor.isActive("link")} title="Link"><LinkIcon /></BBtn>
            <BBtn onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline code"><Code /></BBtn>
          </div>
        </div>
      )}

      {editable && fontMenu.open && (
        <div
          ref={fontMenuRef}
          style={{ top: fontMenu.top, left: fontMenu.left }}
          className="absolute z-50 w-36 rounded-xl border border-border bg-surface p-1 shadow-md"
        >
          {FONT_SIZES.map((fs) => (
            <button
              key={fs.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFontSize(fs.size);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-tertiary",
                fs.size === activeFontSize ? "font-medium text-heading" : "text-body"
              )}
              style={fs.size ? { fontSize: fs.size } : undefined}
            >
              {fs.label}
            </button>
          ))}
        </div>
      )}

      {editable && linkPopover.open && (
        <div
          data-link-popover
          style={{ top: linkPopover.top, left: linkPopover.left }}
          className="absolute z-50 w-72 rounded-xl border border-border bg-surface p-3 shadow-md"
        >
          <input
            ref={linkInputRef}
            type="url"
            aria-label="Link URL"
            value={linkPopover.url}
            onChange={(e) => setLinkPopover((p) => ({ ...p, url: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") setLinkPopover((p) => ({ ...p, open: false }));
            }}
            placeholder="https://"
            className="input-base focus:input-focus"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={applyLink} className="btn-base btn-primary min-h-7! px-2.5! py-1! text-xs!">
              Apply
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkPopover((p) => ({ ...p, open: false }));
                }}
                className="btn-base btn-ghost min-h-7! px-2.5! py-1! text-xs! text-danger!"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setLinkPopover((p) => ({ ...p, open: false }))}
              className="btn-base btn-ghost ml-auto min-h-7! px-2.5! py-1! text-xs!"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editable && slashMenu.open && filteredSlashCmds.length > 0 && (
        <div
          ref={slashMenuRef}
          style={{ top: slashMenu.top, left: slashMenu.left }}
          className="absolute z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-md"
        >
          <p className="px-2 pb-1 pt-1.5 text-overline">Insert block</p>
          {filteredSlashCmds.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySlashCommand(cmd);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                i === slashMenu.selected ? "bg-surface-tertiary" : "hover:bg-surface-tertiary"
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-secondary font-mono text-[0.6875rem] text-heading">
                {cmd.icon}
              </span>
              <span>
                <span className="block text-sm text-heading">{cmd.label}</span>
                <span className="block text-xs text-muted">{cmd.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-surface scrollbar-thin">
        {children}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

NoteEditor.displayName = "NoteEditor";

export default NoteEditor;
