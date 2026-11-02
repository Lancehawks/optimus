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

// Logos and photos are shown at 56px at most, so they're shrunk before
// upload. A logo keeps its aspect ratio, so a wide wordmark is fitted into
// its tile rather than cropped; a photo is cropped to a centred square.
async function shrinkImage(file, { purpose, name, square = false, maxSize = 256 }) {
  if (!isAllowedContentType(purpose, file?.type)) {
    throw new Error("Choose a PNG, JPEG, WebP or GIF image.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try another file.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const source = square
    ? { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, width: side, height: side }
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Browsers that can't encode WebP fall back to PNG; both keep transparency.
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("That image couldn't be read. Try another file.");
  return new File([blob], `${name}.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type });
}

export function prepareProjectLogo(file) {
  return shrinkImage(file, { purpose: "project_logo", name: "logo" });
}

export function prepareProfilePhoto(file) {
  return shrinkImage(file, { purpose: "avatar", name: "photo", square: true });
}
