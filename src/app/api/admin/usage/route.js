import { withAdmin, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { query } from "@/lib/db";
import { readMonthlyBudgetUsd } from "@/lib/assistant/store";
import { usageSummary } from "@/lib/assistant/usage";
import { logError } from "@/lib/logger";

export const GET = withAdmin(async (request) => {
  try {
    const usage = await usageSummary({ query }, { budgetUsd: readMonthlyBudgetUsd() });
    return apiNoStoreResponse({ usage });
  } catch (error) {
    logError("admin.usage_load_failed", error, { actorId: request.user.id });
    return apiError("Could not load assistant usage", 500);
  }
});
