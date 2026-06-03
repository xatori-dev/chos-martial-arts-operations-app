export function childUsernameFromName(name: string) {
  const usernameBase = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${usernameBase || "student"}.child`;
}

export function normalizeChildUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^-|-$/g, "");
}
