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

export function normalizeAvatarValue(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  return getAvatarPreset(trimmed)?.value || "";
}
