import { fileUrl } from "./uploadRules.js";

export const AVATAR_PRESETS = [
  {
    id: "boy-hoodie",
    label: "Boy Hoodie",
    value: "preset:boy-hoodie",
    image: "/avatars/boy-hoodie.svg",
  },
  {
    id: "girl-bob",
    label: "Girl Bob",
    value: "preset:girl-bob",
    image: "/avatars/girl-bob.svg",
  },
  {
    id: "boy-curly",
    label: "Boy Curly",
    value: "preset:boy-curly",
    image: "/avatars/boy-curly.svg",
  },
  {
    id: "girl-bun",
    label: "Girl Bun",
    value: "preset:girl-bun",
    image: "/avatars/girl-bun.svg",
  },
  {
    id: "boy-glasses",
    label: "Boy Glasses",
    value: "preset:boy-glasses",
    image: "/avatars/boy-glasses.svg",
  },
  {
    id: "girl-curls",
    label: "Girl Curls",
    value: "preset:girl-curls",
    image: "/avatars/girl-curls.svg",
  },
  {
    id: "boy-jacket",
    label: "Boy Jacket",
    value: "preset:boy-jacket",
    image: "/avatars/boy-jacket.svg",
  },
  {
    id: "girl-scarf",
    label: "Girl Scarf",
    value: "preset:girl-scarf",
    image: "/avatars/girl-scarf.svg",
  },
];

export function getAvatarPreset(value) {
  return AVATAR_PRESETS.find((preset) => preset.value === value) || null;
}

// An uploaded profile photo is stored as "file:<uploaded file id>".
const PHOTO_PREFIX = "file:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function photoAvatarValue(fileId) {
  return `${PHOTO_PREFIX}${fileId}`;
}

export function avatarPhotoId(value) {
  if (typeof value !== "string" || !value.startsWith(PHOTO_PREFIX)) return null;
  const id = value.slice(PHOTO_PREFIX.length);
  return UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export function normalizeAvatarValue(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  const photoId = avatarPhotoId(trimmed);
  if (photoId) return photoAvatarValue(photoId);
  return getAvatarPreset(trimmed)?.value || "";
}

// What an <img> shows for a stored avatar, or for a local preview's blob URL.
export function avatarImageUrl(value) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("blob:")) return value;
  const photoId = avatarPhotoId(value);
  if (photoId) return fileUrl(photoId);
  return getAvatarPreset(value)?.image || null;
}
