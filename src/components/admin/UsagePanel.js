"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { ErrorState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/api";
import DailySpendChart from "./DailySpendChart";
import { formatCompact, formatCount, formatDay, formatUsd, formatUtcDay } from "./format";

function StatTile({ label, value, children }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-[1.75rem] font-semibold leading-9 tracking-tight text-heading">{value}</p>
      {children}
    </div>
  );
}

// The fill carries severity; the track is a lighter step of the same ramp.
function BudgetMeter({ spent, budget, month }) {
  const share = budget > 0 ? spent / budget : 1;
  const state = share >= 1 ? "over" : share >= 0.8 ? "near" : "ok";
  const track = { ok: "bg-brand-100", near: "bg-warning-light", over: "bg-danger-light" }[state];
  const fill = { ok: "bg-primary", near: "bg-warning", over: "bg-danger" }[state];
  const [year, monthIndex] = month.split("-").map(Number);
  const resumes = formatUtcDay(new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10), { month: "long", day: "numeric" });

  return (
    <div className="mt-3">
      <div
        className={cn("h-1.5 overflow-hidden rounded-full", track)}
        role="meter"
        aria-label="Share of this month's assistant budget used"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(spent, budget)}
        aria-valuetext={`${formatUsd(spent)} of ${formatUsd(budget)}`}
      >
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        of {formatUsd(budget)} budget · {Math.min(999, Math.round(share * 100))}% used
      </p>
      {state === "near" && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-body">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          Nearly at this month&apos;s limit.
        </p>
      )}
      {state === "over" && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-body">
          <OctagonAlert className="mt-px h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
          Limit reached. The assistant is paused for everyone until {resumes}.
        </p>
      )}
    </div>
  );
}

function MemberTable({ members }) {
  if (members.length === 0) return <p className="text-sm text-muted">Nobody has used the assistant this month.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[0.6875rem] text-muted">
            <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Model calls</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Input tokens</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Output tokens</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Workspace key</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Own keys</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Last used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.id || "former"}>
              <td className="px-4 py-2.5">
                <span className="block text-heading">{member.name}</span>
                {member.email && <span className="block text-xs text-muted">{member.email}</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-heading">{formatCount(member.calls)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-heading">{formatCompact(member.inputTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-heading">{formatCompact(member.outputTokens)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-heading">{formatUsd(member.costUsd)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">{formatUsd(member.ownKeyCostUsd)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">{formatDay(member.lastUsedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UsagePanel() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getUsage();
      setUsage(data.usage);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !usage) return <ErrorState title="Couldn't load assistant usage" description={error} onRetry={load} />;
  if (!usage) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => <div key={tile} className="skeleton h-28" />)}
      </div>
    );
  }

  const monthLabel = formatUtcDay(`${usage.month}-01`, { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-overline">{monthLabel}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Workspace key spend" value={formatUsd(usage.spentUsd)}>
            <BudgetMeter spent={usage.spentUsd} budget={usage.budgetUsd} month={usage.month} />
          </StatTile>
          <StatTile label="Workspace key calls" value={formatCount(usage.calls)}>
            <p className="mt-2 text-xs text-muted">A question takes one call per lookup, plus one to answer.</p>
          </StatTile>
          <StatTile label="Workspace key tokens in" value={formatCompact(usage.inputTokens)}>
            <p className="mt-2 text-xs text-muted">
              <span className="font-mono tabular-nums text-body">{formatCompact(usage.outputTokens)}</span> out, including reasoning.
              Input counts cached tokens.
            </p>
          </StatTile>
          <StatTile label="Members' own keys" value={formatUsd(usage.ownKeys.costUsd)}>
            <p className="mt-2 text-xs text-muted">
              {formatCount(usage.ownKeys.calls)} call{usage.ownKeys.calls === 1 ? "" : "s"}, paid by members. Not counted toward the budget.
            </p>
          </StatTile>
        </div>
      </section>

      <DailySpendChart days={usage.daily} />

      <section>
        <h2 className="mb-3 text-overline">By member, this month</h2>
        <MemberTable members={usage.members} />
      </section>

      {usage.models.length > 0 && (
        <section>
          <h2 className="mb-3 text-overline">By model, this month</h2>
          <ul className="card divide-y divide-border">
            {usage.models.map((model) => (
              <li key={`${model.provider}:${model.model}:${model.keySource}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block text-heading">{model.label}</span>
                  <span className="block font-mono text-[0.6875rem] text-muted">
                    {model.provider}:{model.model} · {model.keySource === "workspace" ? "workspace key" : "members' keys"}
                  </span>
                </span>
                <span className="font-mono text-[0.8125rem] tabular-nums text-muted">
                  {formatCount(model.calls)} calls · {formatUsd(model.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        Costs are estimates from token counts at list prices. Your Anthropic bill is the final figure. Change the monthly
        budget with the AI_MONTHLY_BUDGET_USD setting.
      </p>
    </div>
  );
}
