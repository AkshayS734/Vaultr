/**
 * Class composition utility for Tailwind CSS
 * Merges classNames while handling conflicts intelligently
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes
    .filter((c) => c && typeof c === "string")
    .join(" ")
    .split(" ")
    .filter((c) => c.length > 0)
    .filter((c, i, a) => a.indexOf(c) === i)
    .join(" ");
}
