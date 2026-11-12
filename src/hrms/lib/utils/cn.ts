/**
 * Joins class names, skipping falsy values.
 * Intentionally tiny so we don't need clsx / tailwind-merge.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
