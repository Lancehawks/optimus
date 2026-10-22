"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { Badge, Button, ErrorState, Toggle, useToast } from "@/components/ui";
import { adminService } from "@/services/api";
import { formatDay } from "./format";

const PROVIDER_ORDER = ["anthropic", "openrouter"];

function price(value) {
  if (value === null || value === undefined) return "—";
  return value === 0 ? "free" : `$${value < 1 ? value.toFixed(2) : value.toFixed(value % 1 ? 2 : 0)}`;
}

function CheckStatus({ check }) {
  if (!check) return <p className="text-xs text-muted">Not checked yet</p>;
  const Icon = check.passed ? CircleCheck : CircleX;
  return (
    <p className="flex items-start gap-1.5 text-xs text-body">
      <Icon className={check.passed ? "mt-px h-3.5 w-3.5 shrink-0 text-success" : "mt-px h-3.5 w-3.5 shrink-0 text-danger"} aria-hidden="true" />
      <span>
        {check.detail}{" "}
        <span className="text-muted">({check.checkedBy ? `${check.checkedBy}, ` : ""}{formatDay(check.checkedAt)})</span>
      </span>
    </p>
  );
}

function ModelRow({ model, workspaceRole, canCheck, onChange }) {
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
          {model.free && <Badge size="sm" variant="neutral">Free</Badge>}
          {model.openWeights && <Badge size="sm" variant="outline">Open weights</Badge>}
          {workspaceRole && <Badge size="sm">{workspaceRole === "default" ? "Workspace default" : "Workspace"}</Badge>}
        </div>
        <p className="font-mono text-[0.6875rem] text-muted">
          {model.id} · {price(model.inputPrice)} in / {price(model.outputPrice)} out per M tokens
          {model.agenticIndex !== null && ` · agentic index ${model.agenticIndex}`}
        </p>
        <CheckStatus check={model.check} />
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <Button size="sm" variant="secondary" onClick={runCheck} isLoading={checking} disabled={!canCheck}>
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
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-sm leading-6 text-muted">
        <p>
          Members with their own key can pick any model that&apos;s offered for that provider. A check asks the model
          &ldquo;What&apos;s on my plate today?&rdquo; against a made-up workspace and passes only if it looks the day up
          and answers with what it found. OpenRouter models can be offered only after they pass, and a failed check
          stops offering one.
        </p>
        <p>
          Checks run on your own key for that provider, or on the workspace key for the workspace models.
          Each costs a few cents at most; on a free model it uses up to four of your daily free requests.
          {!data.models.some((model) => model.provider === "openrouter" && data.canCheck[model.key]) && (
            <> To check OpenRouter models, <Link href="/settings#api-keys" className="font-medium text-heading underline underline-offset-4">add your own OpenRouter key</Link>.</>
          )}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.provider}>
          <h2 className="mb-3 text-overline">{group.models[0].providerLabel}</h2>
          <ul className="card divide-y divide-border">
            {group.models.map((model) => (
              <ModelRow
                key={model.key}
                model={model}
                workspaceRole={model.key === data.workspaceDefault ? "default" : data.workspaceModels.includes(model.key) ? "member" : null}
                canCheck={Boolean(data.canCheck[model.key])}
                onChange={replace}
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
