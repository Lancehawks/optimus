import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import {
  getProjectForMember,
  listProjectMembers,
  removeProjectMember,
} from "@/lib/projectAccess";

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id, userId } = await params;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    if (project.user_id !== request.user.id) {
      return apiError("Only the project creator can remove collaborators", 403);
    }

    if (project.user_id === userId) {
      return apiError("Project creator cannot be removed", 400);
    }

    const countResult = await query(
      "SELECT COUNT(*)::int AS count FROM project_members WHERE project_id = $1",
      [id]
    );

    if ((countResult.rows[0]?.count || 0) <= 1) {
      return apiError("Project must have at least one member", 400);
    }

    const memberResult = await query(
      "SELECT full_name, email FROM users WHERE id = $1",
      [userId]
    );

    const removed = await removeProjectMember(id, userId);
    if (!removed) {
      return apiError("Project member not found", 404);
    }

    const removedUser = memberResult.rows[0];
    await recordProjectActivity({
      projectId: id,
      actorUserId: request.user.id,
      action: "removed",
      entityType: "member",
      entityId: userId,
      entityTitle: removedUser?.full_name || removedUser?.email || "Collaborator",
    });

    const members = await listProjectMembers(id);
    return apiResponse({ message: "Project member removed", members });
  } catch (error) {
    console.error("Project member remove error:", error);
    return apiError("Internal server error", 500);
  }
});
