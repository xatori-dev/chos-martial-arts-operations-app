export type AppThemeMode = "dark" | "light";
export const visualColorKeys = [
  "background",
  "surface",
  "elevatedSurface",
  "text",
  "mutedText",
  "primary",
  "secondary",
  "button",
  "buttonText",
  "border",
  "success",
  "danger"
] as const;

export type VisualColorKey = typeof visualColorKeys[number];
export type VisualThemeColors = Record<VisualColorKey, string>;

export const appThemeStorageKey = "chos.theme.v1";
export const defaultAppTheme: AppThemeMode = "dark";
export const defaultVisualThemeColors: VisualThemeColors = {
  background: "#13243a",
  surface: "#1f3147",
  elevatedSurface: "#2b4058",
  text: "#fbf7f2",
  mutedText: "#c9c0b5",
  primary: "#e4cf9a",
  secondary: "#786dff",
  button: "#e4cf9a",
  buttonText: "#172033",
  border: "#d8c28a",
  success: "#38c993",
  danger: "#f06b6b"
};

const visualThemeStoragePrefix = "chos.visualTheme";

function normalizedThemeEmail(sessionEmail?: string) {
  return (sessionEmail ?? "guest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "") || "guest";
}

export function visualThemeStorageKey(sessionEmail?: string) {
  return `${visualThemeStoragePrefix}.${normalizedThemeEmail(sessionEmail)}.v1`;
}

export function isAppThemeMode(value: unknown): value is AppThemeMode {
  return value === "dark" || value === "light";
}

export function readStoredAppTheme(): AppThemeMode {
  if (typeof window === "undefined") return defaultAppTheme;
  try {
    const saved = window.localStorage.getItem(appThemeStorageKey);
    return isAppThemeMode(saved) ? saved : defaultAppTheme;
  } catch {
    return defaultAppTheme;
  }
}

export function applyAppTheme(theme: AppThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function writeStoredAppTheme(theme: AppThemeMode) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(appThemeStorageKey, theme);
    } catch {
      // Theme still applies for the current session when localStorage is blocked.
    }
  }
  applyAppTheme(theme);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeVisualThemeColors(value: unknown): VisualThemeColors {
  const saved = typeof value === "object" && value !== null ? value as Partial<Record<VisualColorKey, unknown>> : {};
  return visualColorKeys.reduce<VisualThemeColors>((colors, key) => {
    const nextColor = saved[key];
    colors[key] = isHexColor(nextColor) ? nextColor.trim().toLowerCase() : defaultVisualThemeColors[key];
    return colors;
  }, { ...defaultVisualThemeColors });
}

export function readStoredVisualTheme(sessionEmail?: string): VisualThemeColors | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const saved = window.localStorage.getItem(visualThemeStorageKey(sessionEmail));
    if (!saved) return undefined;
    return normalizeVisualThemeColors(JSON.parse(saved));
  } catch {
    return undefined;
  }
}

export function writeStoredVisualTheme(sessionEmail: string | undefined, colors: VisualThemeColors) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(visualThemeStorageKey(sessionEmail), JSON.stringify(normalizeVisualThemeColors(colors)));
    } catch {
      // The visual theme still applies for the current session when storage is blocked.
    }
  }
  applyVisualTheme(colors);
}

export function clearStoredVisualTheme(sessionEmail?: string) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(visualThemeStorageKey(sessionEmail));
    } catch {
      // Clearing the current session theme still works when localStorage is blocked.
    }
  }
  applyVisualTheme(undefined);
}

export function applyVisualTheme(colors?: VisualThemeColors) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!colors) {
    delete root.dataset.customColors;
    visualColorKeys.forEach((key) => root.style.removeProperty(`--user-visual-${key}`));
    return;
  }

  root.dataset.customColors = "true";
  const normalizedColors = normalizeVisualThemeColors(colors);
  visualColorKeys.forEach((key) => {
    root.style.setProperty(`--user-visual-${key}`, normalizedColors[key]);
  });
}

export function applyStoredVisualTheme(sessionEmail?: string) {
  const storedTheme = readStoredVisualTheme(sessionEmail);
  applyVisualTheme(storedTheme);
}

export function initializeAppTheme() {
  applyAppTheme(readStoredAppTheme());
}
