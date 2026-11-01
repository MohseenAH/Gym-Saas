"use client";

import { useEffect, useState } from "react";

export type GymTheme = "light" | "dark" | "iron" | "sage";

export const THEME_CONFIGS: Record<
  GymTheme,
  { label: string; description: string; primaryColor: string; bgTone: string }
> = {
  light: {
    label: "Crisp Emerald",
    description: "Default crisp white background with refined emerald accent",
    primaryColor: "#059669",
    bgTone: "#ffffff",
  },
  dark: {
    label: "Electric Obsidian",
    description: "Deep obsidian surfaces with athletic electric lime accent",
    primaryColor: "#84cc16",
    bgTone: "#080a0f",
  },
  iron: {
    label: "Forge Iron",
    description: "High-intensity charcoal iron with blazing forge amber accent",
    primaryColor: "#f97316",
    bgTone: "#12100e",
  },
  sage: {
    label: "Nordic Sage",
    description: "Boutique mineral oat linen with deep Nordic teal accent",
    primaryColor: "#0f766e",
    bgTone: "#f7f5f0",
  },
};

export function getStoredTheme(): GymTheme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("gymapra_theme") as GymTheme | null;
  if (stored && ["light", "dark", "iron", "sage"].includes(stored)) {
    return stored;
  }
  return "light";
}

export function setGymTheme(theme: GymTheme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("gymapra_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function useGymTheme() {
  const [theme, setThemeState] = useState<GymTheme>("light");

  useEffect(() => {
    const current = getStoredTheme();
    setThemeState(current);
    document.documentElement.setAttribute("data-theme", current);
  }, []);

  const changeTheme = (newTheme: GymTheme) => {
    setThemeState(newTheme);
    setGymTheme(newTheme);
  };

  return { theme, changeTheme, themes: THEME_CONFIGS };
}
