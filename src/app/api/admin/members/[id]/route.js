import { withAdmin, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { query, transaction } from "@/lib/db";
import { MemberError, changedFields, getMember, updateMember } from "@/lib/members";
import { logError, logInfo } from "@/lib/logger";

const db = { query, transaction };

function invalidId(id) {
  return optionalUuid(id, "Member", { allowNull: false }).error;
}

export const GET = withAdmin(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Member ID is invalid");
  try {
    const member = await getMember(db, id);
    if (!member) return apiError("Member not found", 404);
    return apiNoStoreResponse({ member });
  } catch (error) {
    logError("admin.member_load_failed", error, { actorId: request.user.id });
    return apiError("Could not load the member", 500);
  }
});

export const PATCH = withAdmin(async (request, { params }) => {
  const { id } = await params;
  if (invalidId(id)) return apiError("Member ID is invalid");
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);

  const changes = {
    fullName: body.fullName,
    email: body.email,
    timezone: body.timezone,
    role: body.role,
    isActive: body.isActive,
    assistantEnabled: body.assistantEnabled,
    password: body.password,
  };
  try {
    await updateMember(db, id, changes, { actorId: request.user.id });
    // Field names only: never log passwords, emails or names.
    logInfo("admin.member_updated", { actorId: request.user.id, memberId: id, fields: changedFields(changes) });
    return apiNoStoreResponse({ member: await getMember(db, id) });
  } catch (error) {
    if (error instanceof MemberError) return apiError(error.message, error.status);
    logError("admin.member_update_failed", error, { actorId: request.user.id, memberId: id });
    return apiError("Could not update the member", 500);
  }
});
