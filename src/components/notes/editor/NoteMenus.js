"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  BlockColorsItem,
  DragHandleMenu,
  FormattingToolbar,
  FormattingToolbarController,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
  usePortalElement,
} from "@blocknote/react";
import { ListChecks, PenLine, Sparkles } from "lucide-react";
import { searchService } from "@/services/api";
import { MENTION_KINDS, inlineText } from "./schema";

// BlockNote renders the toolbar and menus it is given as components. They are
// defined once, here, and read the note's handlers from context: a component
// created during render would be a new type each time, so every autosave
// would remount the toolbar and close any open caption or link box.
const NoteMenuContext = createContext({ onAssist: () => {}, assistEnabled: false, onCreateTask: null, noteId: null });

const SELECTION_ACTIONS = [
  { action: "improve", label: "Improve writing" },
  { action: "fix", label: "Fix spelling and grammar" },
  { action: "shorter", label: "Make shorter" },
  { action: "summarize", label: "Summarize" },
];

// ── Slash menu: BlockNote's blocks plus writing help ──────────────
function NoteSlashMenu() {
  const editor = useBlockNoteEditor();
  const { onAssist, assistEnabled } = useContext(NoteMenuContext);
  const getItems = useCallback(async (query) => {
    const items = getDefaultReactSlashMenuItems(editor);
    if (assistEnabled) {
      items.push(
        {
          title: "Continue writing",
          subtext: "Let AI write the next paragraph",
          aliases: ["ai", "continue", "write"],
          group: "AI",
          icon: <PenLine size={18} />,
          onItemClick: () => onAssist("continue"),
        },
        {
          title: "Summarize note",
          subtext: "Add a summary of this note",
          aliases: ["ai", "summary", "tldr"],
          group: "AI",
          icon: <ListChecks size={18} />,
          onItemClick: () => onAssist("summarizeNote"),
        },
      );
    }
    return filterSuggestionItems(items, query);
  }, [editor, onAssist, assistEnabled]);

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />;
}

// ── "@" links to tasks, projects and notes ───────────────────────
const searchCache = new Map();

async function searchMentions(query, excludeNoteId) {
  const q = query.trim();
  if (q.length < 2) return null;
  if (!searchCache.has(q)) {
    searchCache.set(q, searchService.global(q).then((data) => data.results || []).catch(() => []));
    if (searchCache.size > 50) searchCache.delete(searchCache.keys().next().value);
  }
  const results = await searchCache.get(q);
  return results.filter((result) => MENTION_KINDS[result.type] && !(result.type === "note" && result.id === excludeNoteId));
}

function NoteMentionMenu() {
  const editor = useBlockNoteEditor();
  const { noteId } = useContext(NoteMenuContext);
  const getItems = useCallback(async (query) => {
    const results = await searchMentions(query, noteId);
    if (results === null) {
      return [{ title: "Link a task, project or note", subtext: "Keep typing to search", onItemClick: () => {} }];
    }
    return results.slice(0, 8).map((result) => {
      const { Icon, label } = MENTION_KINDS[result.type];
      return {
        title: result.title,
        subtext: result.meta || label,
        group: `${label}s`,
        icon: <Icon size={18} />,
        onItemClick: () => {
          editor.insertInlineContent([
            { type: "mention", props: { kind: result.type, id: result.id, label: result.title } },
            " ",
          ]);
        },
      };
    });
  }, [editor, noteId]);

  return <SuggestionMenuController triggerCharacter="@" getItems={getItems} />;
}

// ── Selection toolbar with an AI menu ─────────────────────────────
function AssistMenu() {
  const Components = useComponentsContext();
  const portalElement = usePortalElement();
  const { onAssist } = useContext(NoteMenuContext);
  return (
    <Components.Generic.Menu.Root position="bottom-start" portalElement={portalElement}>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className="bn-button"
          label="Ask AI"
          mainTooltip="Edit the selection with AI"
          icon={<Sparkles size={16} />}
        >
          <span className="note-assist-trigger"><Sparkles size={15} aria-hidden="true" />AI</span>
        </Components.FormattingToolbar.Button>
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown className="bn-menu-dropdown">
        {SELECTION_ACTIONS.map(({ action, label }) => (
          <Components.Generic.Menu.Item key={action} className="bn-menu-item" onClick={() => onAssist(action)}>
            {label}
          </Components.Generic.Menu.Item>
        ))}
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  );
}

function NoteFormattingToolbar() {
  const { assistEnabled } = useContext(NoteMenuContext);
  return (
    <FormattingToolbar>
      {getFormattingToolbarItems()}
      {assistEnabled && <AssistMenu key="assist" />}
    </FormattingToolbar>
  );
}

// ── Block menu with "Turn into task" ──────────────────────────────
function TurnIntoTaskItem() {
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  const { onCreateTask } = useContext(NoteMenuContext);
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  const text = block ? inlineText(block.content).trim() : "";
  const alreadyTask = Array.isArray(block?.content)
    && block.content.some((item) => item.type === "mention" && item.props.kind === "task");
  if (!onCreateTask || !text || alreadyTask) return null;

  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={() => onCreateTask(block, text)}>
      Turn into task
    </Components.Generic.Menu.Item>
  );
}

function NoteDragHandleMenu() {
  const dict = useDictionary();
  return (
    <DragHandleMenu>
      <TurnIntoTaskItem />
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
      <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
      <TableColumnHeaderItem>{dict.drag_handle.header_column_menuitem}</TableColumnHeaderItem>
    </DragHandleMenu>
  );
}

function NoteSideMenu(props) {
  return <SideMenu {...props} dragHandleMenu={NoteDragHandleMenu} />;
}

// All of the editor's custom menus, for an editable note.
export function NoteMenus({ onAssist, assistEnabled, onCreateTask, noteId }) {
  const value = useMemo(
    () => ({ onAssist, assistEnabled, onCreateTask, noteId }),
    [onAssist, assistEnabled, onCreateTask, noteId]
  );
  return (
    <NoteMenuContext.Provider value={value}>
      <NoteSlashMenu />
      <NoteMentionMenu />
      <FormattingToolbarController formattingToolbar={NoteFormattingToolbar} />
      <SideMenuController sideMenu={NoteSideMenu} />
    </NoteMenuContext.Provider>
  );
}
