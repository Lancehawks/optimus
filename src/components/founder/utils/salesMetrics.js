import { LEAD_STAGES } from "../constants";

const sumValues = (leads) => leads.reduce((total, lead) => total + Number(lead.value || 0), 0);

/**
 * Commercial overview derived from the lead ledger (single pass by stage).
 * @param {import("../types").Lead[]} leads
 * @returns {import("../types").SalesMetrics}
 */
export function computeSalesMetrics(leads) {
  const byStageLeads = new Map(LEAD_STAGES.map((stage) => [stage, []]));
  for (const lead of leads) byStageLeads.get(lead.stage)?.push(lead);

  const won = byStageLeads.get("won");
  const lost = byStageLeads.get("lost");
  const open = leads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
  const closedCount = won.length + lost.length;
  const byStage = LEAD_STAGES
    .filter((stage) => stage !== "lost")
    .map((stage) => ({ stage, count: byStageLeads.get(stage).length, value: sumValues(byStageLeads.get(stage)) }));

  return {
    wonValue: sumValues(won),
    pipelineValue: sumValues(open),
    openCount: open.length,
    conversion: closedCount ? Math.round((won.length / closedCount) * 100) : 0,
    byStage,
    largestStage: Math.max(1, ...byStage.map((stage) => stage.count)),
  };
}

/** Won value as a percentage of the sales target, capped at 100. */
export function salesTargetProgress(wonValue, salesTarget) {
  return salesTarget > 0 ? Math.min(100, (wonValue / salesTarget) * 100) : 0;
}

export function isValidSalesTarget(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}
