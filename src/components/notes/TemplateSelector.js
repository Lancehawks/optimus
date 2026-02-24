"use client";

import { cn } from "@/lib/utils";

const templates = [
  {
    name: "blank",
    label: "Blank Note",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    content: "",
  },
  {
    name: "meeting_notes",
    label: "Meeting Notes",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    content: `<h2>Meeting Notes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><ul><li></li></ul><h3>Discussion</h3><p></p><h3>Action Items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"></li></ul><h3>Follow-ups</h3><ul><li></li></ul>`,
  },
  {
    name: "daily_reflection",
    label: "Daily Reflection",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    content: `<h2>Daily Reflection</h2><h3>What went well today?</h3><ul><li></li></ul><h3>What could be improved?</h3><ul><li></li></ul><h3>What am I grateful for?</h3><ul><li></li></ul><h3>Key takeaway</h3><p></p>`,
  },
  {
    name: "standup",
    label: "Standup",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    content: `<h2>Standup Update</h2><h3>Yesterday</h3><ul><li></li></ul><h3>Today</h3><ul><li></li></ul><h3>Blockers</h3><ul><li></li></ul>`,
  },
];

export default function TemplateSelector({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((template) => (
        <button
          key={template.name}
          onClick={() => onSelect(template)}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-[var(--radius-lg)] border border-border",
            "hover:border-brand-300 hover:bg-brand-50/50 transition-colors cursor-pointer text-center"
          )}
        >
          <span className="text-muted">{template.icon}</span>
          <span className="text-body-sm text-heading! font-medium">{template.label}</span>
        </button>
      ))}
    </div>
  );
}

export { templates };
