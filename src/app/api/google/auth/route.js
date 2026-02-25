import { withAuth, apiResponse } from "@/lib/apiUtils";
import { getAuthUrl } from "@/lib/google";

export const GET = withAuth(async (request) => {
  const url = getAuthUrl(request.user.id);
  return apiResponse({ url });
});
