import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";

export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { action } = await request.json();

    if (!["accept", "decline"].includes(action)) {
      return apiError("Action must be accept or decline", 400);
    }

    if (action === "accept") {
      const result = await query(
        `WITH accepted_invite AS (
           UPDATE project_invitations
           SET status = 'accepted', responded_at = NOW()
           WHERE id = $1
             AND invitee_user_id = $2
             AND status = 'pending'
           RETURNING id, project_id
         ),
         inserted_member AS (
           INSERT INTO project_members (project_id, user_id)
           SELECT project_id, $2
           FROM accepted_invite
           ON CONFLICT (project_id, user_id) DO NOTHING
           RETURNING project_id
         )
         SELECT ai.id, ai.project_id, p.name AS project_name
         FROM accepted_invite ai
         JOIN projects p ON p.id = ai.project_id`,
        [id, request.user.id]
      );

      if (result.rows.length === 0) {
        return apiError("Invitation not found", 404);
      }

      await recordProjectActivity({
        projectId: result.rows[0].project_id,
        actorUserId: request.user.id,
        action: "joined",
        entityType: "member",
        entityId: request.user.id,
        entityTitle: request.user.full_name || request.user.email,
      });

      return apiResponse({
        invitation: {
          id: result.rows[0].id,
          status: "accepted",
          project_id: result.rows[0].project_id,
          project_name: result.rows[0].project_name,
        },
      });
    }

    const result = await query(
      `UPDATE project_invitations
       SET status = 'declined', responded_at = NOW()
       WHERE id = $1
         AND invitee_user_id = $2
         AND status = 'pending'
       RETURNING id, project_id`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Invitation not found", 404);
    }

    return apiResponse({
      invitation: {
        id: result.rows[0].id,
        status: "declined",
        project_id: result.rows[0].project_id,
      },
    });
  } catch (error) {
    console.error("Project invitation response error:", error);
    return apiError("Internal server error", 500);
  }
});
