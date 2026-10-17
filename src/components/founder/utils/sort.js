// Client-side mirrors of each collection route's ORDER BY, so a created or
// edited item lands where a reload would put it. Array#sort is stable, so ties
// keep the server's creation order.

function compareOptional(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

function rankBy(order) {
  return (value) => {
    const rank = order.indexOf(value);
    return rank === -1 ? order.length : rank;
  };
}

const targetRank = rankBy(["active", "paused"]);
const leadRank = rankBy(["negotiation", "proposal", "qualified", "contacted", "new", "won"]);

export function newestFirst(a, b) {
  return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
}

export const sortMilestones = (a, b) => compareOptional(a.milestoneOn, b.milestoneOn);
export const sortTargets = (a, b) => targetRank(a.status) - targetRank(b.status) || compareOptional(a.deadline, b.deadline);
export const sortLeads = (a, b) => leadRank(a.stage) - leadRank(b.stage) || compareOptional(a.followUpOn, b.followUpOn) || newestFirst(a, b);
export const sortNotes = newestFirst;
