import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { PROVIDERS } from "@/lib/ai/models";
import { assistantDb } from "@/lib/assistant/server";
import { listKeys } from "@/lib/assistant/keys";
import { logError } from "@/lib/logger";

// The member's own provider keys, as hints only. The keys themselves never
// leave the server.
export const GET = withAuth(async (request) => {
  try {
    const keys = await listKeys(assistantDb, request.user.id);
    return apiNoStoreResponse({
      providers: Object.values(PROVIDERS).map((provider) => ({
        id: provider.id,
        label: provider.label,
        keyPlaceholder: provider.keyPlaceholder,
        keysUrl: provider.keysUrl,
        key: keys.find((row) => row.provider === provider.id) || null,
      })),
    });
  } catch (error) {
    logError("assistant.keys_list_failed", error, { userId: request.user.id });
    return apiError("Could not load your API keys", 500);
  }
});
