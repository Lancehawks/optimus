import { PROVIDERS, getModel, listModels } from "../ai/models.js";
import { keyProviders, loadKey } from "./keys.js";

// Which models a member can use, and which key pays:
// - their own key, for any enabled model of a provider they have a key for;
// - the workspace key, for the workspace models (Haiku and Sonnet by default),
//   if an admin allows it (users.ai_assistant_enabled_at) and they have no key
//   of their own for that provider.
// `workspace` is { models, defaultKey, provider, configured } from
// workspaceContext(): the workspace models, default first, and whether this
// server has their provider's key.

export class AccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function modelSettings(db) {
  const result = await db.query(
    `SELECT s.model_key, s.enabled, s.check_passed, s.check_detail, s.checked_at, checker.full_name AS checked_by
     FROM ai_model_settings s
     LEFT JOIN users checker ON checker.id = s.checked_by`
  );
  return new Map(result.rows.map((row) => [row.model_key, row]));
}

export function isModelEnabled(model, setting) {
  return setting ? setting.enabled : Boolean(model.defaultEnabled);
}

function option(model, keySource) {
  return {
    key: model.key,
    label: model.label,
    provider: model.provider,
    providerLabel: PROVIDERS[model.provider]?.label || model.provider,
    free: Boolean(model.free),
    openWeights: Boolean(model.openWeights),
    keySource,
  };
}

export async function availableModels(db, user, workspace) {
  const [providers, settings] = await Promise.all([keyProviders(db, user.id), modelSettings(db)]);
  const options = listModels()
    .filter((model) => providers.has(model.provider) && isModelEnabled(model, settings.get(model.key)))
    .map((model) => option(model, "member"));
  if (user.ai_assistant_enabled_at && workspace?.configured && !providers.has(workspace.provider)) {
    // The default is always offered; other workspace models follow the
    // admin's on/off choice on the Models tab.
    const workspaceOptions = (workspace.models || [])
      .filter((model) => model.key === workspace.defaultKey || isModelEnabled(model, settings.get(model.key)))
      .map((model) => option(model, "workspace"));
    options.unshift(...workspaceOptions);
  }
  return { options, providers: [...providers] };
}

// The model a new message should use when the member didn't pick one: their
// last choice if they can still use it, then the workspace default, then the
// first paid model, then anything available.
export function defaultModelKey(user, options, workspaceDefaultKey = null) {
  return options.find((entry) => entry.key === user.ai_model)?.key
    || options.find((entry) => entry.key === workspaceDefaultKey)?.key
    || options.find((entry) => !entry.free)?.key
    || options[0]?.key
    || null;
}

// Resolves a member's choice to a model and the key that pays for it.
export async function resolveModelChoice(db, user, requestedKey, workspace) {
  const { options } = await availableModels(db, user, workspace);
  if (options.length === 0) {
    throw new AccessError("Add your own API key in Settings, or ask an admin for access to the workspace AI key.");
  }
  const key = requestedKey || defaultModelKey(user, options, workspace?.defaultKey);
  const choice = options.find((entry) => entry.key === key);
  if (!choice) throw new AccessError("That model isn't available to you. Pick another one.");
  const model = getModel(choice.key);
  const apiKey = choice.keySource === "member" ? await loadKey(db, user.id, model.provider) : null;
  if (choice.keySource === "member" && !apiKey) throw new AccessError("Your API key for this model was removed. Add it again in Settings.");
  return { model, keySource: choice.keySource, apiKey };
}
