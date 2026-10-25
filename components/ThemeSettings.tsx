"use client";

import { SegmentedControl } from "@/components/interior/segmented-control";

import { PressButton } from "@/components/interior/press-depth";

import type { CSSProperties } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useThemeSettings } from "./ThemeProvider";
import { DEFAULT_THEME_SETTINGS, THEMES, type Theme } from "@/lib/themes/catalog";
import styles from "./ThemeSettings.module.css";

function previewStyle(theme: Theme): CSSProperties {
  return {
    "--preview-bg": theme.tokens.background,
    "--preview-surface": theme.tokens.surface,
    "--preview-ink": theme.tokens.foreground,
    "--preview-accent": theme.tokens.accent,
  } as CSSProperties;
}

function Swatches({ theme }: { theme: Theme }) {
  return <span className={styles.swatches} style={previewStyle(theme)} aria-hidden="true">
    <i /><i /><i /><i />
  </span>;
}

export function ThemeSettings() {
  const { settings, saving, message, error, update } = useThemeSettings();
  const isDefault = Object.entries(DEFAULT_THEME_SETTINGS).every(([key, value]) =>
    settings[key as keyof typeof settings] === value);

  return <section className={`surface ${styles.appearance}`} aria-labelledby="appearance-title">
    <div className={styles.heading}>
      <div>
        <h2 id="appearance-title"><Palette size={18} aria-hidden="true" />Appearance</h2>
        <p>Choose a palette for each mode. System follows your device automatically.</p>
      </div>
      <PressButton type="button" className={styles.reset} disabled={saving || isDefault}
        onClick={() => void update(DEFAULT_THEME_SETTINGS)}>Reset to defaults</PressButton>
    </div>
    <SegmentedControl name="theme-mode" label="Color mode" value={settings.mode} disabled={saving}
      className="my-5 w-full sm:w-fit"
      options={[
        { value: "system", label: "System", icon: <Monitor size={16} aria-hidden="true" /> },
        { value: "light", label: "Light", icon: <Sun size={16} aria-hidden="true" /> },
        { value: "dark", label: "Dark", icon: <Moon size={16} aria-hidden="true" /> },
      ]} onChange={mode => void update({ ...settings, mode })} />
    <div className={styles.pickers}>
      {(["light", "dark"] as const).map((mode) => {
        const selected = THEMES.find((theme) => theme.id === settings[mode])!;
        const themes = THEMES.filter((theme) => theme.mode === mode);
        return <details key={mode} className={styles.picker} name="theme-picker">
          <summary>
            {mode === "light" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            <span><span className={styles.label}>{mode === "light" ? "Light theme" : "Dark theme"}</span>
              <strong>{selected.name}</strong></span>
            <Swatches theme={selected} />
            <span className={styles.chevron} aria-hidden="true">⌄</span>
          </summary>
          <fieldset className={styles.grid} disabled={saving}>
            <legend className="sr-only">{mode === "light" ? "Light theme" : "Dark theme"}</legend>
            {themes.map((theme) => <label key={theme.id} className={styles.option}>
              <input type="radio" name={`${mode}-theme`} value={theme.id}
                checked={settings[mode] === theme.id}
                onChange={() => void update({ ...settings, [mode]: theme.id })} />
              <span className={styles.preview} style={previewStyle(theme)} aria-hidden="true">
                <span className={styles.previewNav}><i /><i /><i /></span>
                <span className={styles.previewBody}><i /><span><i /><i /><i /></span></span>
              </span>
              <span className={styles.optionName}>{theme.name}
                {settings[mode] === theme.id && <Check size={16} aria-hidden="true" />}
              </span>
              {theme.id.startsWith("google-dsa-") && <span className={styles.defaultLabel}>Default</span>}
            </label>)}
          </fieldset>
        </details>;
      })}
    </div>
    <div className={styles.footer}>
      <span role={error ? "alert" : "status"}>{error ?? message}</span>
    </div>
  </section>;
}
