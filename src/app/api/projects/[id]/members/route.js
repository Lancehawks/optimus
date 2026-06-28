import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { createProjectInvitationNotification } from "@/lib/notifications";
import {
  createProjectInvitation,
  getProjectForMember,
  getUserByEmail,
  isProjectMember,
  listProjectMembers,
} from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    const members = await listProjectMembers(id);
    return apiResponse({ members });
  } catch (error) {
    console.error("Project members list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const email = body.email?.trim();

    if (!email) {
      return apiError("Email is required");
    }

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    if (project.user_id !== request.user.id) {
      return apiError("Only the project creator can invite collaborators", 403);
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return apiError("No Optimus user found with that email", 404);
    }

    if (user.id === request.user.id) {
      return apiError("You are already in this project", 400);
    }

    const alreadyMember = await isProjectMember(user.id, id);
    if (alreadyMember) {
      return apiError("This user is already a collaborator", 400);
    }

    const invitation = await createProjectInvitation(id, request.user.id, user.id);
    await createProjectInvitationNotification({
      invitationId: invitation.id,
      projectId: id,
      inviterUserId: request.user.id,
      inviteeUserId: user.id,
    });

    await recordProjectActivity({
      projectId: id,
      actorUserId: request.user.id,
      action: "invited",
      entityType: "member",
      entityId: user.id,
      entityTitle: user.full_name || "a collaborator",
    });

    const members = await listProjectMembers(id);
    return apiResponse({ invitation, invitee: user, members }, 201);
  } catch (error) {
    console.error("Project member add error:", error);
    return apiError("Internal server error", 500);
  }
});
