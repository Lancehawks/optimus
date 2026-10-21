export const ENTRY_DURATION_MS = 900;

export const DEFAULT_COUNTDOWN = Object.freeze({ title: "Main milestone", targetAt: null, updatedAt: null });

export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

export const MILESTONE_STATUS_OPTIONS = [
  ["planned", "Planned"],
  ["active", "In progress"],
  ["achieved", "Achieved"],
];

export const TARGET_STATUS_OPTIONS = [
  ["active", "Active"],
  ["paused", "Paused"],
  ["achieved", "Achieved"],
];

export const EMPTY_MILESTONE = Object.freeze({ title: "", details: "", milestoneOn: "", status: "planned" });
export const EMPTY_TARGET = Object.freeze({ title: "", currentValue: 0, targetValue: "", unit: "", deadline: "", status: "active" });
export const EMPTY_LEAD = Object.freeze({ clientName: "", company: "", email: "", owner: "", stage: "new", value: 0, followUpOn: "", notes: "" });
export const EMPTY_NOTE = Object.freeze({ title: "", body: "" });

export const NOTE_MAX_LENGTH = 12000;
