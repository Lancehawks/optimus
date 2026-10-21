import { cn } from "@/lib/utils";

export const LANCEHAWKS_NAVY = "#2c4c87";

// Transparent masks cut from public/Lancehawks Logo.png, so the mark can take any colour.
const MARKS = {
  crest: { src: "/brand/lancehawks-crest.png", ratio: 540 / 193 },
  logo: { src: "/brand/lancehawks-logo.png", ratio: 540 / 292 },
};

/**
 * The Lancehawks crest (wings only) or the full logo with its wordmark.
 * `height` is in pixels; the width follows the artwork's proportions.
 */
export default function LancehawksMark({ variant = "crest", height = 20, color = LANCEHAWKS_NAVY, label, className = "" }) {
  const mark = MARKS[variant];
  const mask = {
    WebkitMaskImage: `url(${mark.src})`,
    maskImage: `url(${mark.src})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0", className)}
      style={{ width: Math.round(height * mark.ratio), height, backgroundColor: color, ...mask }}
    />
  );
}
