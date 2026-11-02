"use client";

/* eslint-disable @next/next/no-img-element -- Photos are private uploads served by /api/files, which next/image can't fetch. */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { avatarImageUrl } from "@/lib/avatarOptions";

const sizeClasses = {
  xs: "h-5 w-5 text-[0.625rem]",
  sm: "h-7 w-7 text-2xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-16 w-16 text-lg",
};

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ src, alt, name, size = "md", className }) {
  const image = avatarImageUrl(src);
  const [failedImage, setFailedImage] = useState(null);
  const showImage = Boolean(image) && failedImage !== image;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised font-medium text-body ring-1 ring-black/5",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      role="img"
      aria-label={alt || name || "Avatar"}
    >
      {showImage ? (
        <img
          src={image}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailedImage(image)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
