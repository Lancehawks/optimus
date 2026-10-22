"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { Button, Input, useToast } from "@/components/ui";
import { assistantService } from "@/services/api";
import { formatDate } from "@/lib/utils";

function ProviderKey({ provider, onChanged }) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const saved = provider.key;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await assistantService.saveKey(provider.id, value);
      setValue("");
      setEditing(false);
      addToast({ message: `${provider.label} key saved`, type: "success" });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    try {
      await assistantService.deleteKey(provider.id);
      addToast({ message: `${provider.label} key removed`, type: "success" });
      onChanged();
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setConfirmingRemove(false);
    }
  };

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <KeyRound className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-heading">{provider.label}</p>
          <p className="font-mono text-[0.6875rem] text-muted">
            {saved ? `${saved.key_hint} · added ${formatDate(saved.updated_at)}` : "No key"}
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => { setEditing(true); setConfirmingRemove(false); }}>
              {saved ? "Replace" : "Add key"}
            </Button>
            {saved && (
              <Button
                size="sm"
                variant={confirmingRemove ? "danger" : "ghost"}
                onClick={remove}
                onBlur={() => setConfirmingRemove(false)}
              >
                {confirmingRemove ? "Remove key" : "Remove"}
              </Button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <form onSubmit={save} className="mt-3 space-y-2">
          <Input
            label={`${provider.label} API key`}
            id={`key-${provider.id}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={provider.keyPlaceholder}
            error={error}
            hint={(
              <>
                We check it with {provider.label}, then store it encrypted. You&apos;ll only see its last characters again.{" "}
                <a href={provider.keysUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
                  Get a key <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </>
            )}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(""); setError(null); }} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={saving} disabled={!value.trim()}>Check and save</Button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function ApiKeysSettings() {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await assistantService.listKeys();
      setProviders(data.providers);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <p className="text-sm text-danger">
        {error}{" "}
        <button type="button" onClick={load} className="cursor-pointer font-medium underline underline-offset-4">Try again</button>
      </p>
    );
  }
  if (!providers) return <div className="skeleton h-28" />;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        With your own key you can use the assistant without an admin&apos;s approval, and pick its models in the chat.
        You pay the provider directly. OpenRouter gives one key for many models, including some free ones.
      </p>
      <ul className="card divide-y divide-border">
        {providers.map((provider) => (
          <ProviderKey key={provider.id} provider={provider} onChanged={load} />
        ))}
      </ul>
      <p className="text-xs leading-5 text-muted">
        When you use your own key, your questions and the workspace items the assistant looks up go to that provider
        under your account&apos;s terms. Free models are often run by providers that may log or train on what&apos;s sent.
      </p>
    </div>
  );
}
