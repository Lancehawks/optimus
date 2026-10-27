"use client";

/* eslint-disable @next/next/no-img-element -- Logos are private uploads served by /api/files, which next/image can't fetch. */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/uploadRules";

const sizeClasses = {
  "2xs": "h-3.5 w-3.5 rounded-[4px] text-[0.625rem]",
  xs: "h-[1.125rem] w-[1.125rem] rounded-[5px] text-[0.75rem]",
  sm: "h-6 w-6 rounded-md text-[0.9375rem]",
  md: "h-10 w-10 rounded-[10px] text-[1.375rem]",
  lg: "h-14 w-14 rounded-xl text-[1.875rem]",
};

export function projectLogoUrl(project) {
  return project?.logo_file_id ? fileUrl(project.logo_file_id) : null;
}

function initialOf(name) {
  const letter = String(name || "").trim().match(/\p{L}|\p{N}/u)?.[0];
  return letter ? letter.toUpperCase() : "·";
}

// A project's logo, or its initial on a tint of its colour when it has none.
// Decorative: the project's name always sits beside it.
export default function ProjectMark({ project, logoUrl = projectLogoUrl(project), size = "md", className }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const color = project?.color || "var(--neutral-400)";
  const showLogo = Boolean(logoUrl) && failedUrl !== logoUrl;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-serif leading-none",
        sizeClasses[size] || sizeClasses.md,
        showLogo && "bg-white ring-1 ring-black/[0.06] dark:ring-white/10",
        className
      )}
      style={showLogo ? undefined : {
        backgroundColor: `color-mix(in srgb, ${color} 14%, var(--neutral-800))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 24%, transparent)`,
        color: `color-mix(in srgb, ${color} 78%, var(--neutral-0))`,
      }}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailedUrl(logoUrl)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="pt-[0.08em]">{initialOf(project?.name)}</span>
      )}
    </span>
  );
}
