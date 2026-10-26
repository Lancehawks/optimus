// What can be uploaded where. Shared by the upload token route, file
// registration and the file server, so the three never disagree.

const MB = 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
const MEDIA_TYPES = [
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg", "audio/webm",
  "video/mp4", "video/webm", "video/quicktime",
];
const DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/rtf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// SVG, HTML and other scriptable formats are never accepted: files are served
// from this origin.
export const UPLOAD_RULES = {
  note: { maxBytes: 25 * MB, contentTypes: [...IMAGE_TYPES, ...MEDIA_TYPES, ...DOCUMENT_TYPES] },
  resource: { maxBytes: 50 * MB, contentTypes: [...IMAGE_TYPES, ...MEDIA_TYPES, ...DOCUMENT_TYPES] },
};

// Shown inline by the browser; everything else downloads.
const INLINE_TYPES = new Set([...IMAGE_TYPES, ...MEDIA_TYPES, "application/pdf", "text/plain"]);

// Files are only ever linked through this route, never by their blob URL.
export function fileUrl(id) {
  return `/api/files/${id}`;
}

export function isUploadPurpose(value) {
  return Object.hasOwn(UPLOAD_RULES, value);
}

export function uploadPrefix(userId, purpose) {
  return `users/${userId}/${purpose}/`;
}

// A member can only register blobs uploaded under their own prefix.
export function isOwnPathname(pathname, userId, purpose) {
  if (typeof pathname !== "string" || pathname.length > 512) return false;
  const prefix = uploadPrefix(userId, purpose);
  const rest = pathname.slice(prefix.length);
  return pathname.startsWith(prefix) && rest.length > 0 && !rest.includes("/") && !rest.includes("..");
}

export function normalizeContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

export function isAllowedContentType(purpose, contentType) {
  return Boolean(UPLOAD_RULES[purpose]?.contentTypes.includes(normalizeContentType(contentType)));
}

// Keeps the readable part of a name for the blob path; the original name is
// stored separately for display and downloads.
export function safeFileName(name) {
  const cleaned = String(name || "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-120);
  return cleaned || "file";
}

export function displayFileName(name) {
  const cleaned = String(name || "").replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 255);
  return cleaned || "file";
}

export function isInlineContentType(contentType) {
  return INLINE_TYPES.has(normalizeContentType(contentType));
}

// Library resources are typed by what was uploaded.
export function resourceTypeFor(contentType) {
  const type = normalizeContentType(contentType);
  if (type === "application/pdf") return "pdf";
  if (IMAGE_TYPES.includes(type)) return "image";
  if (DOCUMENT_TYPES.includes(type)) return "doc";
  return "other";
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < MB) return `${Math.round(value / 1024)} KB`;
  return `${(value / MB).toFixed(value < 10 * MB ? 1 : 0)} MB`;
}
