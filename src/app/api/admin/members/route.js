import { withAdmin, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { query, transaction } from "@/lib/db";
import { MemberError, createMember, getMember, listMembers } from "@/lib/members";
import { logError, logInfo } from "@/lib/logger";

const db = { query, transaction };

export const GET = withAdmin(async (request) => {
  try {
    const members = await listMembers(db);
    return apiNoStoreResponse({ members });
  } catch (error) {
    logError("admin.members_list_failed", error, { actorId: request.user.id });
    return apiError("Could not load members", 500);
  }
});

// Adds a member directly with a password the admin shares with them. The
// invitation flow in Settings remains the way to let someone set their own.
export const POST = withAdmin(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  try {
    const id = await createMember(db, {
      email: body.email,
      fullName: body.fullName,
      password: body.password,
      role: body.role,
      timezone: body.timezone,
      assistantEnabled: body.assistantEnabled,
    }, { actorId: request.user.id });
    logInfo("admin.member_created", { actorId: request.user.id, memberId: id, role: body.role || "member" });
    return apiNoStoreResponse({ member: await getMember(db, id) }, 201);
  } catch (error) {
    if (error instanceof MemberError) return apiError(error.message, error.status);
    logError("admin.member_create_failed", error, { actorId: request.user.id });
    return apiError("Could not add the member", 500);
  }
});
