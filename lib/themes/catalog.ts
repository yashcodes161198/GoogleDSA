import palettes from "./pomotroid.json";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeSettings = { mode: ThemeMode; light: string; dark: string };
export type Theme = {
  id: string;
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: "system", light: "google-dsa-light", dark: "google-dsa-dark",
};

const light = {
  background: "#f5f7fa", foreground: "#202936", surface: "#ffffff",
  "surface-subtle": "#edf1f6", line: "#dce2e9", muted: "#586577",
  accent: "#3659b5", "accent-hover": "#294796", "accent-soft": "#e9effc",
  "accent-text": "#304fa0", "accent-contrast": "#ffffff", success: "#26704d",
};
const dark = {
  background: "#15191f", foreground: "#eef2f6", surface: "#1c222b",
  "surface-subtle": "#252d39", line: "#364151", muted: "#a5b1c2",
  accent: "#466cc9", "accent-hover": "#5279d7", "accent-soft": "#273650",
  "accent-text": "#aac3ff", "accent-contrast": "#ffffff", success: "#8bd4ab",
  "color-zinc-500": "#a5b1c2", "color-blue-600": "#8fb2ff",
  "color-blue-700": "#aac3ff", "color-destructive": "#ffaaaa",
};

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function mix(a: string, b: string, weight: number) {
  const other = rgb(b);
  return "#" + rgb(a).map((value, i) => Math.round(value * (1 - weight) + other[i] * weight)
    .toString(16).padStart(2, "0")).join("");
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function readable(color: string, backgrounds: string[]) {
  const target = luminance(backgrounds[0]) > 0.5 ? "#000000" : "#ffffff";
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, target, step / 20);
    if (backgrounds.every((background) => contrast(candidate, background) >= 4.5)) return candidate;
  }
  return target;
}

function fromPomotroid(palette: typeof palettes[number]): Theme {
  const c = palette.colors;
  const background = c["--color-background"];
  const originalForeground = c["--color-foreground"];
  const mode = luminance(background) > 0.5 ? "light" : "dark";
  const surface = c["--color-background-light"];
  const subtle = mix(surface, originalForeground, 0.05);
  const backgrounds = [background, surface, subtle];
  const foreground = readable(originalForeground, backgrounds);
  const accent = c["--color-accent"];
  const soft = mix(surface, accent, 0.12);
  const accentText = readable(accent, [...backgrounds, soft]);
  const muted = readable(c["--color-foreground-darker"], backgrounds);
  const line = mix(surface, foreground, 0.22);
  const tokens: Record<string, string> = {
    background, foreground, surface, "surface-subtle": subtle, line, muted, accent,
    "accent-hover": mix(accent, foreground, 0.1), "accent-soft": soft,
    "accent-text": accentText,
    "accent-contrast": contrast(accent, "#ffffff") >= contrast(accent, "#000000") ? "#ffffff" : "#000000",
    success: readable(c["--color-short-round"], backgrounds),
    "color-destructive": readable(c["--color-focus-round"], backgrounds),
  };
  const zinc = mode === "light"
    ? [background, subtle, line, line, muted, muted, foreground, foreground, foreground, foreground, foreground]
    : [foreground, foreground, foreground, muted, muted, muted, muted, line, subtle, surface, surface];
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((shade, i) => {
    tokens[`color-zinc-${shade}`] = zinc[i];
  });
  for (const shade of [50, 100, 200, 300, 600, 700, 900, 950]) {
    tokens[`color-blue-${shade}`] = [50, 100, 950].includes(shade) ? soft : accentText;
  }
  return { id: palette.id, name: palette.name, mode, tokens };
}

export const THEMES: Theme[] = [
  { id: "google-dsa-light", name: "Google DSA Light", mode: "light", tokens: light },
  { id: "google-dsa-dark", name: "Google DSA Dark", mode: "dark", tokens: dark },
  ...palettes.map(fromPomotroid),
];

export function parseThemeSettings(value: unknown): ThemeSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.mode !== "system" && v.mode !== "light" && v.mode !== "dark") return null;
  if (!THEMES.some((theme) => theme.id === v.light && theme.mode === "light") ||
      !THEMES.some((theme) => theme.id === v.dark && theme.mode === "dark")) return null;
  return { mode: v.mode, light: v.light as string, dark: v.dark as string };
}

export function themeVariables(settings: ThemeSettings): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const mode of ["light", "dark"] as const) {
    const theme = THEMES.find((t) => t.id === settings[mode])!;
    for (const [key, value] of Object.entries(theme.tokens)) variables[`--${mode}-${key}`] = value;
  }
  return variables;
}
