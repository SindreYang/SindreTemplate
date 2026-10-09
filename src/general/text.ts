/** Convert human text to a stable, dependency-free URL slug. */
export function to_slug(value: string, fallback = "untitled"): string {
  const slug = value.normalize("NFKC").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
