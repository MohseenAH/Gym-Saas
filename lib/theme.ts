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
  "emerald-mist": {
    label: "Emerald Mist",
    description: "Fresh, natural emerald & mist-white identity (Default Light).",
    primaryColor: "#059669",
    bgTone: "#DDEFE6",
    mode: "light",
    swatchColors: ["#FFFFFF", "#059669"],
  },
  "glacier-frost": {
    label: "Glacier Frost",
    description: "Clean, crisp sapphire & glacier-white SaaS.",
    primaryColor: "#2563EB",
    bgTone: "#DCEAF7",
    mode: "light",
    swatchColors: ["#FFFFFF", "#2563EB"],
  },
  "obsidian-champagne": {
    label: "Obsidian Champagne",
    description: "Premium, elegant dark luxury with warm champagne gold.",
    primaryColor: "#C9A66B",
    bgTone: "#171717",
    mode: "dark",
    swatchColors: ["#242424", "#C9A66B"],
  },
  "electric-sapphire": {
    label: "Electric Sapphire",
    description: "Cool, high-energy deep sapphire with vivid electric blue.",
    primaryColor: "#3B82F6",
    bgTone: "#080F24",
    mode: "dark",
    swatchColors: ["#111D38", "#3B82F6"],
  },
};

export function isDarkTheme(theme: ThemeId | string | null | undefined): boolean {
  return (
    theme === "obsidian-champagne" ||
    theme === "electric-sapphire" ||
    theme === "arctic-titanium" ||
    theme === "dark" ||
    theme === "royal-bordeaux" ||
    theme === "iron"
  );
}

export function normalizeTheme(rawTheme: string | null | undefined): ThemeId {
  if (!rawTheme) return DEFAULT_THEME_ID;
  if (isValidTheme(rawTheme)) return rawTheme;

  // Legacy Theme Fallbacks
  if (rawTheme === "alpine-jade" || rawTheme === "light" || rawTheme === "sage") {
    return "emerald-mist";
  }
  if (rawTheme === "glacier-slate") {
    return "glacier-frost";
  }
  if (rawTheme === "arctic-titanium") {
    return "electric-sapphire";
  }
  if (
    rawTheme === "obsidian-champagne" ||
    rawTheme === "royal-bordeaux" ||
    rawTheme === "dark" ||
    rawTheme === "iron"
  ) {
    return "obsidian-champagne";
  }

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
    document.documentElement.classList.toggle("dark", isDarkTheme(valid));
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
