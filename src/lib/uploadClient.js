"use client";

import { upload } from "@vercel/blob/client";
import { fileService } from "@/services/api";
import { UPLOAD_RULES, formatBytes, isAllowedContentType, safeFileName, uploadPrefix } from "@/lib/uploadRules";

let storageCheck = null;

async function ensureStorageConfigured() {
  storageCheck ||= fetch("/api/uploads", { credentials: "include" })
    .then((response) => (response.ok ? response.json() : { configured: true }))
    .catch(() => ({ configured: true }));
  const { configured } = await storageCheck;
  if (!configured) {
    storageCheck = null;
    throw new Error("File uploads aren't set up yet. An admin needs to connect Vercel Blob storage.");
  }
}

// Uploads a file straight to Vercel Blob, then registers it. Resolves to the
// saved file, whose `url` (/api/files/<id>) is the only way it is linked.
export async function uploadWorkspaceFile(file, { userId, purpose, noteId = null, onProgress } = {}) {
  const rules = UPLOAD_RULES[purpose];
  if (!isAllowedContentType(purpose, file.type)) {
    throw new Error("That file type isn't supported. Try an image, PDF, document, audio or video file.");
  }
  if (file.size > rules.maxBytes) {
    throw new Error(`Files can be up to ${formatBytes(rules.maxBytes)}. This one is ${formatBytes(file.size)}.`);
  }
  await ensureStorageConfigured();

  let blob;
  try {
    blob = await upload(`${uploadPrefix(userId, purpose)}${safeFileName(file.name)}`, file, {
      access: "private",
      handleUploadUrl: "/api/uploads",
      clientPayload: JSON.stringify({ purpose }),
      contentType: file.type,
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
    });
  } catch (error) {
    throw new Error(error?.message?.includes("client token")
      ? "The upload couldn't start. Check your connection and try again."
      : "The upload failed. Try again.");
  }

  const { file: saved } = await fileService.register({ pathname: blob.pathname, purpose, noteId, name: file.name });
  return saved;
}
