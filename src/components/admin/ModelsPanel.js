"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Badge, Button, Checkbox, ErrorState, Toggle, useToast } from "@/components/ui";
import { adminService } from "@/services/api";
import { formatDay } from "./format";

const PROVIDER_ORDER = ["anthropic", "openrouter"];

function price(value) {
  if (value === null || value === undefined) return "—";
  return value === 0 ? "free" : `$${value < 1 ? value.toFixed(2) : value.toFixed(value % 1 ? 2 : 0)}`;
}

// The check result as a label beside the name; the details sit underneath.
function CheckBadge({ check }) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted">
        <CircleDashed className="h-3 w-3" aria-hidden="true" /> Not checked
      </span>
    );
  }
  return check.passed ? (
    <Badge size="sm" variant="success"><CircleCheck className="h-3 w-3" aria-hidden="true" /> Passed</Badge>
  ) : (
    <Badge size="sm" variant="danger"><CircleX className="h-3 w-3" aria-hidden="true" /> Failed</Badge>
  );
}

// The badge already says passed or failed, so the detail drops that prefix.
function checkSummary(detail) {
  const text = detail
    .replace(/^Failed:\s*/, "")
    .replace(/^Passed in (\d+) calls?:\s*/, (_, calls) => `${calls} call${calls === "1" ? "" : "s"}: `);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function CheckDetail({ check }) {
  if (!check) return null;
  return (
    <p className="text-xs text-muted">
      {checkSummary(check.detail)} · {check.checkedBy ? `${check.checkedBy}, ` : ""}{formatDay(check.checkedAt)}
    </p>
  );
}

function ModelRow({ model, workspaceRole, canCheck, onChange, batchChecking, batchRunning }) {
  const { addToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [toggling, setToggling] = useState(false);
  const canEnable = !model.needsCheck || model.check?.passed;

  const runCheck = async () => {
    setChecking(true);
    try {
      const data = await adminService.checkModel(model.key);
      onChange(data.model);
      addToast({
        message: data.model.check?.passed ? `${model.label} passed` : `${model.label} didn't pass`,
        type: data.model.check?.passed ? "success" : "error",
      });
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setChecking(false);
    }
  };

  const toggle = async (enabled) => {
    setToggling(true);
    try {
      const data = await adminService.setModelEnabled(model.key, enabled);
      onChange(data.model);
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setToggling(false);
    }
  };

  return (
    <li className="grid gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-heading">{model.label}</span>
          <CheckBadge check={model.check} />
          {model.free && <Badge size="sm" variant="neutral">Free</Badge>}
          {model.openWeights && <Badge size="sm" variant="outline">Open weights</Badge>}
          {workspaceRole && <Badge size="sm">{workspaceRole === "default" ? "Workspace default" : "Workspace"}</Badge>}
        </div>
        <p className="font-mono text-[0.6875rem] text-muted">
          {model.id} · {price(model.inputPrice)} in / {price(model.outputPrice)} out per M tokens
          {model.agenticIndex !== null && ` · agentic index ${model.agenticIndex}`}
        </p>
        <CheckDetail check={model.check} />
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <Button
          size="sm"
          variant="secondary"
          onClick={runCheck}
          isLoading={checking || batchChecking}
          disabled={!canCheck || batchRunning}
          title={canCheck ? undefined : `Needs your own ${model.providerLabel} key`}
        >
          {model.check ? "Check again" : "Run check"}
        </Button>
        <Toggle
          checked={model.enabled}
          onChange={toggle}
          disabled={toggling || (!model.enabled && !canEnable)}
          label={model.enabled ? "Offered" : "Off"}
        />
      </div>
    </li>
  );
}

export default function ModelsPanel() {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [batch, setBatch] = useState(null);
  const [offerPassing, setOfferPassing] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminService.listModels());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <ErrorState title="Couldn't load models" description={error} onRetry={load} />;
  if (!data) return <div className="skeleton h-64" />;

  const replace = (updated) => {
    setData((current) => ({ ...current, models: current.models.map((model) => (model.key === updated.key ? updated : model)) }));
  };
  const groups = PROVIDER_ORDER
    .map((provider) => ({ provider, models: data.models.filter((model) => model.provider === provider) }))
    .filter((group) => group.models.length > 0);
  const pendingIn = (group) => group.models.filter((model) => data.canCheck[model.key] && !model.check?.passed);

  // Checks run one after another; each is its own request to the model.
  const runBatch = async (group) => {
    const queue = pendingIn(group);
    const tally = { passed: 0, failed: 0, couldNotRun: 0, firstProblem: null };
    for (const [index, model] of queue.entries()) {
      setBatch({ provider: group.provider, current: model.key, done: index, total: queue.length });
      try {
        const result = await adminService.checkModel(model.key);
        let updated = result.model;
        if (updated.check?.passed) {
          tally.passed += 1;
          if (offerPassing && !updated.enabled) updated = (await adminService.setModelEnabled(model.key, true)).model;
        } else {
          tally.failed += 1;
        }
        replace(updated);
      } catch (err) {
        tally.couldNotRun += 1;
        tally.firstProblem ||= err.message;
      }
    }
    setBatch(null);
    const parts = [`${tally.passed} passed`, `${tally.failed} didn't pass`];
    if (tally.couldNotRun) parts.push(`${tally.couldNotRun} couldn't run (${tally.firstProblem})`);
    addToast({ message: `${parts.join(", ")}.`, type: tally.passed > 0 ? "success" : "error" });
  };

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm leading-6 text-body">
          Choose which models members can pick. OpenRouter models need a passing check before you can offer them.
        </p>
        {!data.models.some((model) => model.provider === "openrouter" && data.canCheck[model.key]) && (
          <p className="text-sm leading-6 text-muted">
            To check OpenRouter models, <Link href="/settings#api-keys" className="font-medium text-heading underline underline-offset-4">add your own OpenRouter key</Link> first.
          </p>
        )}
        <details className="group text-sm leading-6 text-muted">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-body hover:text-heading [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
            How checks work
          </summary>
          <div className="mt-2 space-y-2 border-l border-border pl-4">
            <p>
              A check asks the model &ldquo;What&apos;s on my plate today?&rdquo; against a made-up workspace. It passes
              only if the model looks the day up and answers with the task and event it found. A failed check stops
              offering the model.
            </p>
            <p>
              Checks run on your own key for that provider, or on the workspace key for the workspace models. Each
              costs a few cents at most; on a free model it uses up to four of your daily free requests. Paid OpenRouter
              models need credits on your OpenRouter account.
            </p>
          </div>
        </details>
      </div>

      {groups.map((group) => (
        <section key={group.provider}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-overline">{group.models[0].providerLabel}</h2>
            {pendingIn(group).length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <Checkbox
                  checked={offerPassing}
                  onChange={(event) => setOfferPassing(event.target.checked)}
                  disabled={Boolean(batch)}
                  label="Switch on models that pass"
                  className="text-xs"
                />
                <Button size="sm" onClick={() => runBatch(group)} isLoading={batch?.provider === group.provider} disabled={Boolean(batch)}>
                  {batch?.provider === group.provider
                    ? `Checking ${batch.done + 1} of ${batch.total}`
                    : `Check ${pendingIn(group).length} model${pendingIn(group).length === 1 ? "" : "s"}`}
                </Button>
              </div>
            )}
          </div>
          <ul className="card divide-y divide-border">
            {group.models.map((model) => (
              <ModelRow
                key={model.key}
                model={model}
                workspaceRole={model.key === data.workspaceDefault ? "default" : data.workspaceModels.includes(model.key) ? "member" : null}
                canCheck={Boolean(data.canCheck[model.key])}
                onChange={replace}
                batchChecking={batch?.current === model.key}
                batchRunning={Boolean(batch)}
              />
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-muted">
        Members who may use the workspace key get the workspace models that are offered, and always the default.
        Prices are list prices per million tokens;
        usage figures use the cost OpenRouter reports for each request.
      </p>
    </div>
  );
}
