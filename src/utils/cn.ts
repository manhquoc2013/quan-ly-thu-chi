/**
 * Simple className joiner — joins truthy class names with space.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
