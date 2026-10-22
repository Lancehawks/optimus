import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";
import { cleanSearchText, searchWorkspace, SEARCH_QUERY_MAX_LENGTH } from "@/lib/workspaceSearch";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = cleanSearchText(searchParams.get("q")).slice(0, SEARCH_QUERY_MAX_LENGTH);

    if (q.length < 2) {
      return apiResponse({ results: [] });
    }

    const rateLimit = await checkRateLimits(request, [{
      scope: "search:user",
      identifier: request.user.id,
      limit: 120,
      windowMs: 60 * 1000,
    }]);
    if (!rateLimit.allowed) {
      return apiError("Search is temporarily rate limited. Please retry shortly.", 429);
    }

    const results = await searchWorkspace({ query }, request.user.id, q);
    return apiResponse({ results });
  } catch (error) {
    console.error("Global search error:", error);
    return apiError("Internal server error", 500);
  }
});
