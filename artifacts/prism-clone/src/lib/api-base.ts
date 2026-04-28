/**
 * API origin for @workspace/api-client-react setBaseUrl (paths are /api/...).
 * Set VITE_API_BASE_URL when the UI is static (e.g. GitHub Pages) and the API is elsewhere.
 */
export function getApiOriginOverride(): string | undefined {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) return undefined;
  let s = raw.replace(/\/+$/, "");
  if (s.endsWith("/api")) s = s.slice(0, -4).replace(/\/+$/, "");
  return s || undefined;
}

/** Base URL for raw fetch calls (includes trailing .../api, no trailing slash). */
export const API_BASE: string = (() => {
  const origin = getApiOriginOverride();
  if (origin) return `${origin}/api`;
  const pathBase = String(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return pathBase ? `${pathBase}/api` : "/api";
})();
