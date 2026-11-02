import { handleUpload } from "@vercel/blob/client";
import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";
import { BLOB_NOT_CONFIGURED, isBlobConfigured } from "@/lib/blobStorage";
import { UPLOAD_RULES, isOwnPathname, isUploadPurpose } from "@/lib/uploadRules";
import { logError } from "@/lib/logger";

class UploadRejected extends Error {}

// Lets the editor and the Library say plainly when storage isn't set up,
// since a failed token request only surfaces as a generic SDK error.
export const GET = withAuth(async () => apiNoStoreResponse({ configured: isBlobConfigured() }));

// Issues a short-lived token so the browser uploads straight to Vercel Blob,
// which keeps large files clear of the function body limit. The token is
// bound to one pathname under the member's own prefix. Once the upload
// finishes, the browser registers the file with POST /api/files.
export const POST = withAuth(async (request) => {
  if (!isBlobConfigured()) return apiError(BLOB_NOT_CONFIGURED, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  if (body?.type !== "blob.generate-client-token") return apiError("Unsupported upload request");

  const userId = request.user.id;
  const rateLimit = await checkRateLimits(request, [
    { scope: "uploads:user", identifier: userId, limit: 120, windowMs: 60 * 60 * 1000, perIp: false },
  ]);
  if (!rateLimit.allowed) {
    return apiError("You've uploaded a lot of files in a short time. Try again later.", 429);
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let purpose = null;
        try {
          purpose = JSON.parse(clientPayload || "{}").purpose;
        } catch {
          // Rejected below.
        }
        if (!isUploadPurpose(purpose) || !isOwnPathname(pathname, userId, purpose)) {
          throw new UploadRejected("This upload isn't allowed.");
        }
        const rules = UPLOAD_RULES[purpose];
        return {
          allowedContentTypes: rules.contentTypes,
          maximumSizeInBytes: rules.maxBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return apiNoStoreResponse(result);
  } catch (error) {
    if (error instanceof UploadRejected) return apiError(error.message, 403);
    logError("uploads.token_failed", error, { userId });
    return apiError("Could not start the upload", 500);
  }
});
