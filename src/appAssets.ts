export function publicAsset(path: string, baseUrl = import.meta.env.BASE_URL || "/") {
  const base = baseUrl || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}
