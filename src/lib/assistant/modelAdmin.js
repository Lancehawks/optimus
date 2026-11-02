import { PROVIDERS, getModel, listModels } from "../ai/models.js";
import { isModelEnabled, modelSettings } from "./access.js";

// Admin control over which models members can pick. A model that isn't on by
// default can only be switched on after a live check (./modelCheck.js) passes,
// and a failing check switches it off, so members only ever see models that
// handled the assistant's lookups correctly.

export class ModelAdminError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listModelStatuses(db) {
  const settings = await modelSettings(db);
  return listModels().map((model) => {
    const setting = settings.get(model.key);
    return {
      key: model.key,
      id: model.id,
      label: model.label,
      provider: model.provider,
      providerLabel: PROVIDERS[model.provider]?.label || model.provider,
      free: Boolean(model.free),
      openWeights: Boolean(model.openWeights),
      agenticIndex: model.agenticIndex ?? null,
      inputPrice: model.pricing?.tiers?.[0]?.input ?? null,
      outputPrice: model.pricing?.tiers?.[0]?.output ?? null,
      enabled: isModelEnabled(model, setting),
      needsCheck: !model.defaultEnabled,
      check: setting?.checked_at
        ? { passed: setting.check_passed, detail: setting.check_detail, checkedAt: setting.checked_at, checkedBy: setting.checked_by }
        : null,
    };
  });
}

export async function setModelEnabled(db, modelKey, enabled, { actorId }) {
  const status = (await listModelStatuses(db)).find((entry) => entry.key === modelKey);
  if (!status) throw new ModelAdminError("Unknown model", 404);
  if (enabled && status.needsCheck && !status.check?.passed) {
    throw new ModelAdminError("Run a check on this model first. Only models that pass can be offered to members.", 409);
  }
  await db.query(
    `INSERT INTO ai_model_settings (model_key, enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (model_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [modelKey, Boolean(enabled), actorId]
  );
}

export async function recordModelCheck(db, modelKey, result, { actorId }) {
  const model = getModel(modelKey);
  if (!model) throw new ModelAdminError("Unknown model", 404);
  // A failure switches the model off; a pass keeps its current state (its
  // default, the first time), leaving the on/off choice to the admin.
  await db.query(
    `INSERT INTO ai_model_settings (model_key, enabled, check_passed, check_detail, checked_at, checked_by, updated_at)
     VALUES ($1, $5::boolean AND $2::boolean, $2, $3, NOW(), $4, NOW())
     ON CONFLICT (model_key) DO UPDATE SET
       check_passed = EXCLUDED.check_passed,
       check_detail = EXCLUDED.check_detail,
       checked_at = NOW(),
       checked_by = EXCLUDED.checked_by,
       enabled = CASE WHEN EXCLUDED.check_passed THEN ai_model_settings.enabled ELSE FALSE END,
       updated_at = NOW()`,
    [modelKey, Boolean(result.passed), result.detail.slice(0, 1000), actorId, Boolean(model.defaultEnabled)]
  );
}
