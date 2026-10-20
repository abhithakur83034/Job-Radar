/**
 * Server-side base URL of the Express API. Falls back to localhost in dev,
 * but fails loudly in production so a missing env var on the host is
 * caught at build/boot instead of surfacing as "fetch failed" on every page.
 */
export function getApiInternalUrl(): string {
  const url = process.env.API_INTERNAL_URL;
  if (url) return url.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_INTERNAL_URL is not set. Set it to your deployed backend URL (e.g. https://your-api.onrender.com) in the hosting provider's environment variables."
    );
  }
  return "http://localhost:4000";
}
