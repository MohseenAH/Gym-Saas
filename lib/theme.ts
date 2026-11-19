"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ThemeId,
  VALID_THEMES,
  isValidTheme,
  THEME_LIST,
  THEMES_BY_ID,
  DEFAULT_THEME_ID,
  ThemeMetadata,
} from "./themes/theme-config";

export type GymTheme = ThemeId;
export type { ThemeId, ThemeMetadata };
export { VALID_THEMES, isValidTheme, THEME_LIST, THEMES_BY_ID, DEFAULT_THEME_ID };

export const THEME_CONFIGS: Record<
  ThemeId,
  {
    label: string;
    description: string;
    primaryColor: string;
    bgTone: string;
    mode: "light" | "dark";
    swatchColors: [string, string];
  }
> = {
  "alpine-jade": {
    label: "Alpine Jade",
    description: "Fresh, natural, green/teal identity.",
    primaryColor: "#0F766E",
    bgTone: "#E2F1EA",
    mode: "light",
    swatchColors: ["#FFFFFF", "#0F766E"],
  },
  "glacier-slate": {
    label: "Glacier Slate",
    description: "Clean, professional, high-trust SaaS.",
    primaryColor: "#2563EB",
    bgTone: "#E1ECF8",
    mode: "light",
    swatchColors: ["#FFFFFF", "#2563EB"],
  },
  "obsidian-champagne": {
    label: "Obsidian Champagne",
    description: "Premium, elegant, dark luxury.",
    primaryColor: "#D49B35",
    bgTone: "#090B0F",
    mode: "dark",
    swatchColors: ["#12151C", "#D49B35"],
  },
  "arctic-titanium": {
    label: "Arctic Titanium",
    description: "Cool, modern, technology-inspired.",
    primaryColor: "#2563EB",
    bgTone: "#08111E",
    mode: "dark",
    swatchColors: ["#0F1C2E", "#2563EB"],
  },
};

export function isDarkTheme(theme: ThemeId | string | null | undefined): boolean {
  return theme === "obsidian-champagne" || theme === "arctic-titanium";
}

export function normalizeTheme(rawTheme: string | null | undefined): ThemeId {
  if (!rawTheme) return DEFAULT_THEME_ID;
  if (isValidTheme(rawTheme)) return rawTheme;
  // Graceful migration & fallbacks
  if (rawTheme === "royal-bordeaux") return "obsidian-champagne";
  if (rawTheme === "dark") return "obsidian-champagne";
  if (rawTheme === "iron") return "obsidian-champagne";
  if (rawTheme === "light" || rawTheme === "sage") return "alpine-jade";
  return DEFAULT_THEME_ID;
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const stored = localStorage.getItem("gymapra_theme");
    return normalizeTheme(stored);
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function setGymTheme(theme: ThemeId | string) {
  if (typeof window === "undefined") return;
  try {
    const valid = normalizeTheme(theme);
    localStorage.setItem("gymapra_theme", valid);
    document.documentElement.setAttribute("data-theme", valid);
    document.documentElement.dataset.theme = valid;
    document.documentElement.classList.toggle(
      "dark",
      valid === "obsidian-champagne" || valid === "arctic-titanium"
    );
    window.dispatchEvent(new CustomEvent("gymapra-theme-change", { detail: valid }));
  } catch {
    // Ignore storage errors
  }
}

export const applyTheme = setGymTheme;
export const setTheme = setGymTheme;

export function useGymTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME_ID);

  const syncTheme = useCallback(() => {
    const current = getStoredTheme();
    setThemeState(current);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", current);
      document.documentElement.dataset.theme = current;
      document.documentElement.classList.toggle("dark", isDarkTheme(current));
    }
  }, []);

  useEffect(() => {
    // Apply immediately on mount
    syncTheme();

    // Listen for theme changes across components and browser tabs
    const handleThemeChange = (e: Event) => {
      const customEvt = e as CustomEvent<ThemeId | string>;
      if (customEvt && customEvt.detail) {
        const valid = normalizeTheme(customEvt.detail);
        setThemeState(valid);
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", valid);
          document.documentElement.dataset.theme = valid;
          document.documentElement.classList.toggle("dark", isDarkTheme(valid));
        }
      } else {
        syncTheme();
      }
    };

    window.addEventListener("gymapra-theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("gymapra-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, [syncTheme]);

  const changeTheme = useCallback((newTheme: ThemeId | string) => {
    const valid = normalizeTheme(newTheme);
    setThemeState(valid);
    setGymTheme(valid);
  }, []);

  return {
    theme,
    changeTheme,
    setTheme: changeTheme,
    applyTheme: changeTheme,
    setGymTheme: changeTheme,
    themes: THEME_CONFIGS,
    themeList: THEME_LIST,
    currentThemeMetadata: THEMES_BY_ID[theme] || THEMES_BY_ID[DEFAULT_THEME_ID],
  };
}
