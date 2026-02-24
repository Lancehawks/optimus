import { withAuth, apiResponse } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  return apiResponse({ user: request.user });
});
