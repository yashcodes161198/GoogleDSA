import assert from "node:assert/strict";
import { DEFAULT_THEME_SETTINGS, THEMES, contrast, parseThemeSettings, themeVariables } from "../lib/themes/catalog";
import palettes from "../lib/themes/pomotroid.json";

assert.equal(THEMES.length, 40);
assert.equal(new Set(THEMES.map((t) => t.id)).size, 40);
assert.deepEqual(DEFAULT_THEME_SETTINGS, { mode: "system", light: "google-dsa-light", dark: "google-dsa-dark" });
assert.equal(themeVariables(DEFAULT_THEME_SETTINGS)["--light-background"], "#f5f7fa");
assert.equal(themeVariables(DEFAULT_THEME_SETTINGS)["--dark-background"], "#15191f");
assert.equal(themeVariables(DEFAULT_THEME_SETTINGS)["--light-accent"], "#3659b5");
assert.equal(themeVariables(DEFAULT_THEME_SETTINGS)["--dark-accent"], "#466cc9");
for (const invalid of [null, {}, { ...DEFAULT_THEME_SETTINGS, mode: "auto" },
  { ...DEFAULT_THEME_SETTINGS, light: "dracula" }, { ...DEFAULT_THEME_SETTINGS, dark: "github" },
  { ...DEFAULT_THEME_SETTINGS, light: "unknown" }]) assert.equal(parseThemeSettings(invalid), null);
for (const mode of ["system", "light", "dark"]) {
  assert.deepEqual(parseThemeSettings({ mode, light: "github", dark: "dracula", ignored: true }),
    { mode, light: "github", dark: "dracula" });
}
for (const palette of palettes) {
  const theme = THEMES.find((t) => t.id === palette.id)!;
  assert.equal(theme.name, palette.name);
  assert.equal(theme.tokens.background, palette.colors["--color-background"]);
  assert.equal(theme.tokens.surface, palette.colors["--color-background-light"]);
  assert.equal(theme.tokens.accent, palette.colors["--color-accent"]);
  for (const fg of ["foreground", "muted", "accent-text", "success", "color-destructive"]) {
    for (const bg of ["background", "surface", "surface-subtle"]) {
      assert.ok(contrast(theme.tokens[fg], theme.tokens[bg]) >= 4.5,
        `${theme.id}: ${fg} on ${bg} must have readable contrast`);
    }
  }
  assert.ok(contrast(theme.tokens["accent-text"], theme.tokens["accent-soft"]) >= 4.5, `${theme.id}: soft accent contrast`);
  assert.ok(contrast(theme.tokens["accent-contrast"], theme.tokens.accent) >= 4.5, `${theme.id}: button contrast`);
}
console.log("Themes passed: original defaults, all 38 source palettes, valid mode pairs, readable text and buttons.");
