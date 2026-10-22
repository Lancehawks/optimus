import { query, transaction } from "@/lib/db";
import { apiError } from "@/lib/apiUtils";

// The assistant modules take a database handle so tests can pass their own.
export const assistantDb = { query, transaction };

// The opt-in is enforced on the server for every assistant route that sends
// or shows conversation content, not only hidden in the interface.
export function assistantDisabledResponse(user) {
  if (user?.ai_assistant_enabled_at) return null;
  return apiError("Turn on the assistant in Settings to use it.", 403);
}
