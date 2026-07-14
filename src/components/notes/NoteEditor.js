"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Mark } from "@tiptap/core";
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
    icon: "☑",
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
    icon: "❝",
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
// The editor canvas is always a light "paper" surface regardless of the
// app theme (see .note-prose), so these use fixed colors, not the
// theme-reactive neutral-* tokens — otherwise they invert to unreadable
// combinations in the light/amethyst themes.
function TBtn({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors cursor-pointer shrink-0",
        isActive
          ? "bg-[#8892a8] text-[#151a24]"
          : "text-[#3d4766] hover:bg-[#b0b8cb] hover:text-[#1c2231]"
      )}
    >
      {children}
    </button>
  );
}

function TDiv() {
  return <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />;
}

// Bubble menu button — always dark, regardless of app theme (see BBtn
// container below), so it must use fixed colors rather than the
// theme-reactive neutral-* scale.
function BBtn({ onClick, isActive, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors cursor-pointer",
        isActive
          ? "bg-[#2e3650] text-white"
          : "text-[#6b7590] hover:bg-[#242c3d] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function NoteEditor({
  content,
  onChange,
  placeholder = "Start writing… or type / for commands",
}) {
  const debounceRef = useRef(null);
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
    content: content || "",
    onUpdate: ({ editor }) => {
      // Auto-save (600ms debounce — snappier than 1500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => onChange?.(editor.getHTML()),
        600
      );

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
          "note-prose focus:outline-none min-h-[400px] px-8 py-6 max-w-3xl mx-auto",
      },
    },
  });

  // Sync external content
  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  // Cleanup debounce
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

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
    <div className="flex flex-col h-full bg-white relative" ref={containerRef}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-200 overflow-x-auto shrink-0">
        {/* Font size */}
        <button
          ref={fontBtnRef}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            openFontMenu();
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-[#2e3650] hover:bg-[#b0b8cb] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          {activeFontLabel}
          <svg
            className="h-2.5 w-2.5 text-[#515c75]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        <TDiv />

        {/* Text formatting */}
        <TBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold (⌘B)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic (⌘I)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline (⌘U)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12H4m16 0h-4M8.5 6A3.5 3.5 0 0112 4.5 3.5 3.5 0 0115.5 8c0 1.5-1 2.5-3.5 4m0 0c2.5 1.5 3.5 2.5 3.5 4a3.5 3.5 0 01-3.5 3.5A3.5 3.5 0 018.5 16" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          title="Highlight"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </TBtn>

        <TDiv />

        {/* Headings */}
        <TBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[0.6rem] font-black tracking-tight leading-none">H1</span>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[0.6rem] font-black tracking-tight leading-none">H2</span>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[0.6rem] font-black tracking-tight leading-none">H3</span>
        </TBtn>

        <TDiv />

        {/* Lists */}
        <TBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003h12m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H4.24m-1.125 6.003h1.125c.621 0 1.125-.504 1.125-1.125 0-.298-.116-.573-.324-.789l-1.926-1.839m2.25 3.753H2.99" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive("taskList")}
          title="Task List"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </TBtn>

        <TDiv />

        {/* Link */}
        <button
          ref={linkBtnRef}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            openLinkPopover();
          }}
          title="Insert Link (⌘K)"
          className={cn(
            "p-1.5 rounded transition-colors cursor-pointer shrink-0",
            editor.isActive("link")
              ? "bg-[#8892a8] text-[#151a24]"
              : "text-[#3d4766] hover:bg-[#b0b8cb] hover:text-[#1c2231]"
          )}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </button>

        <TDiv />

        {/* Code & Quote */}
        <TBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </TBtn>

        <TDiv />

        {/* Undo / Redo */}
        <TBtn
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Undo (⌘Z)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </TBtn>
        <TBtn
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Redo (⌘⇧Z)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </TBtn>
      </div>

      {/* ── Bubble Menu (appears on text selection) ── */}
      {bubbleMenu.visible && (
      <div
        style={{ top: bubbleMenu.top, left: bubbleMenu.left, transform: "translate(-50%, -100%)" }}
        className="absolute z-50 pointer-events-auto"
      >
        <div className="flex items-center gap-0.5 bg-[#151a24] border border-[#242c3d] rounded-lg shadow-xl px-1 py-1">
          <BBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </BBtn>
          <BBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4" />
            </svg>
          </BBtn>
          <BBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
            title="Underline"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
            </svg>
          </BBtn>
          <BBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="Strikethrough"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12H4m16 0h-4M8.5 6A3.5 3.5 0 0112 4.5 3.5 3.5 0 0115.5 8c0 1.5-1 2.5-3.5 4m0 0c2.5 1.5 3.5 2.5 3.5 4a3.5 3.5 0 01-3.5 3.5A3.5 3.5 0 018.5 16" />
            </svg>
          </BBtn>
          <BBtn
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive("highlight")}
            title="Highlight"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </BBtn>
          <div className="w-px h-4 bg-[#242c3d] mx-0.5" />
          <BBtn
            onClick={openLinkPopover}
            isActive={editor.isActive("link")}
            title="Link"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </BBtn>
          <BBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title="Inline Code"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25" />
            </svg>
          </BBtn>
        </div>
      </div>
      )}

      {/* ── Font size dropdown (positioned relative to container) ── */}
      {fontMenu.open && (
        <div
          ref={fontMenuRef}
          style={{ top: fontMenu.top, left: fontMenu.left }}
          className="absolute z-50 w-32 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden"
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
                "w-full text-left px-3 py-2 transition-colors hover:bg-[#c0c5d4] cursor-pointer",
                fs.size === activeFontSize
                  ? "text-indigo-600 font-medium"
                  : "text-[#242c3d]"
              )}
              style={fs.size ? { fontSize: fs.size } : undefined}
            >
              {fs.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Link popover (positioned relative to container) ── */}
      {linkPopover.open && (
        <div
          data-link-popover
          style={{ top: linkPopover.top, left: linkPopover.left }}
          className="absolute z-50 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg p-3"
        >
          <p className="text-xs font-medium text-[#3d4766] mb-1.5">URL</p>
          <input
            ref={linkInputRef}
            type="url"
            value={linkPopover.url}
            onChange={(e) =>
              setLinkPopover((p) => ({ ...p, url: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape")
                setLinkPopover((p) => ({ ...p, open: false }));
            }}
            placeholder="https://"
            className="w-full text-sm px-3 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 text-[#1c2231]"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={applyLink}
              className="flex-1 text-xs font-medium bg-[#151a24] text-white py-1.5 rounded-lg hover:bg-[#242c3d] transition-colors cursor-pointer"
            >
              Apply
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkPopover((p) => ({ ...p, open: false }));
                }}
                className="text-xs font-medium text-[#3d4766] hover:text-red-500 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setLinkPopover((p) => ({ ...p, open: false }))}
              className="text-xs text-[#515c75] hover:text-[#2e3650] py-1.5 px-2 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Slash command menu ── */}
      {slashMenu.open && filteredSlashCmds.length > 0 && (
        <div
          ref={slashMenuRef}
          style={{ top: slashMenu.top, left: slashMenu.left }}
          className="absolute z-50 w-60 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-neutral-100">
            <p className="text-xs text-[#515c75] font-medium">
              Insert block · ↑↓ navigate · ↵ select
            </p>
          </div>
          {filteredSlashCmds.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySlashCommand(cmd);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer",
                i === slashMenu.selected
                  ? "bg-[#b0b8cb]"
                  : "hover:bg-[#c0c5d4]"
              )}
            >
              <span className="w-7 h-7 flex items-center justify-center bg-[#b0b8cb] rounded-md text-[#2e3650] text-[0.65rem] font-bold shrink-0">
                {cmd.icon}
              </span>
              <div>
                <div className="text-sm font-medium text-[#1c2231]">
                  {cmd.label}
                </div>
                <div className="text-xs text-[#515c75]">{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Editor content area ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
