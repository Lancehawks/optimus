import { founderCsvCell } from "@/lib/founderValues";

const HEADERS = ["Client", "Company", "Email", "Owner", "Stage", "Value (INR)", "Follow up", "Notes"];

/** @param {import("../types").Lead[]} leads */
export function buildLeadsCsv(leads) {
  const rows = leads.map((lead) => [lead.clientName, lead.company, lead.email, lead.owner, lead.stage, lead.value, lead.followUpOn, lead.notes]);
  return [HEADERS, ...rows].map((row) => row.map(founderCsvCell).join(",")).join("\r\n");
}

/** @param {import("../types").Lead[]} leads */
export function downloadLeadsCsv(leads) {
  const url = URL.createObjectURL(new Blob([buildLeadsCsv(leads)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `founder-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
