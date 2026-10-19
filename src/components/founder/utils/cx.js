/** Joins CSS-module class names, skipping falsy values. */
export function cx(...classNames) {
  return classNames.filter(Boolean).join(" ");
}
