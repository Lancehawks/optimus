"use client";

import { FileText, Presentation, Sunrise, Users } from "lucide-react";

const templates = [
  {
    name: "blank",
    description: "An empty page.",
    label: "Blank page",
    icon: FileText,
    content: "",
  },
  {
    name: "meeting_notes",
    description: "Attendees, agenda, decisions and actions.",
    label: "Meeting notes",
    icon: Users,
    content: `<h2>Meeting Notes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><ul><li></li></ul><h3>Discussion</h3><p></p><h3>Action Items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"></li></ul><h3>Follow-ups</h3><ul><li></li></ul>`,
  },
  {
    name: "daily_reflection",
    description: "What went well, what to change, what you are grateful for.",
    label: "Daily reflection",
    icon: Sunrise,
    content: `<h2>Daily Reflection</h2><h3>What went well today?</h3><ul><li></li></ul><h3>What could be improved?</h3><ul><li></li></ul><h3>What am I grateful for?</h3><ul><li></li></ul><h3>Key takeaway</h3><p></p>`,
  },
  {
    name: "standup",
    description: "Yesterday, today and blockers.",
    label: "Standup",
    icon: Presentation,
    content: `<h2>Standup Update</h2><h3>Yesterday</h3><ul><li></li></ul><h3>Today</h3><ul><li></li></ul><h3>Blockers</h3><ul><li></li></ul>`,
  },
];

export default function TemplateSelector({ onSelect }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.name}
            type="button"
            onClick={() => onSelect(template)}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-secondary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary text-muted">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-heading">{template.label}</span>
              <span className="block truncate text-xs text-muted">{template.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { templates };
