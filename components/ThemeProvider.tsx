"use client";

import { createContext, useContext, useState } from "react";
import { saveThemeSettings } from "@/app/theme-actions";
import { themeVariables, type ThemeSettings } from "@/lib/themes/catalog";

function apply(settings: ThemeSettings) {
  const root = document.documentElement;
  for (const mode of ["light", "dark"]) {
    for (const key of Array.from(root.style)) {
      if (key.startsWith(`--${mode}-`)) root.style.removeProperty(key);
    }
  }
  for (const [key, value] of Object.entries(themeVariables(settings))) root.style.setProperty(key, value);
  root.dataset.themeMode = settings.mode;
}

const ThemeContext = createContext<{
  settings: ThemeSettings;
  saving: boolean;
  message: string;
  error: string | null;
  update: (settings: ThemeSettings) => Promise<void>;
} | null>(null);

export function ThemeProvider({ initialSettings, children }: {
  initialSettings: ThemeSettings; children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function update(next: ThemeSettings) {
    if (saving) return;
    const previous = settings;
    setSaving(true);
    setError(null);
    setMessage("Saving appearance…");
    setSettings(next);
    apply(next);
    try {
      const result = await saveThemeSettings(next);
      if (result.error) throw new Error(result.error);
      setMessage("Appearance saved.");
    } catch {
      setSettings(previous);
      apply(previous);
      setMessage("");
      setError("Your theme could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <ThemeContext.Provider value={{ settings, saving, message, error, update }}>
    {children}
  </ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme settings require ThemeProvider");
  return context;
}
