export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(value)) return "/profile";
  try {
    const url = new URL(value, "https://lumyvra.invalid");
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== "https://lumyvra.invalid" || /[\\\x00-\x1f\x7f]/.test(decoded) || decoded.startsWith("//") || /^\/(login|api|_next)(\/|$)/.test(decoded)) return "/profile";
    return url.pathname + url.search + url.hash;
  } catch { return "/profile"; }
}
export function loginPath(next: string) { return `/login?next=${encodeURIComponent(safeReturnPath(next))}`; }
