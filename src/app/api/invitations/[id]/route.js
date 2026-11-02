import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse, withAuth } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const invitationId = optionalUuid(id, "Invitation", { allowNull: false });
    if (invitationId.error) return apiError(invitationId.error);

    const result = await query(
      `UPDATE workspace_invitations
       SET revoked_at = NOW()
       WHERE id = $1 AND invited_by = $2 AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING id`,
      [invitationId.value, request.user.id]
    );

    if (result.rows.length === 0) return apiError("Invitation not found", 404);
    return apiNoStoreResponse({ message: "Invitation revoked" });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    return apiError("Internal server error", 500);
  }
});
