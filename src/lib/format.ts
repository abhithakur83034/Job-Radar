export function relativeTime(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function isRemote(location: string): boolean {
  return location.toLowerCase().includes("remote");
}

// Resolves inline <ins>/<del> diff markup down to the final plain-text
// version (accepted insertions, dropped deletions) for the editable
// textarea and copy/download actions on the Tailored Drafts screen.
export function resolveDiffToPlainText(html: string): string {
  return html
    .replace(/<del>[\s\S]*?<\/del>/gi, "")
    .replace(/<\/?ins>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
