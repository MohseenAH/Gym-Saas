// ============================================================================
// GymApra V2 — 4-Theme Central Configuration Engine
// ============================================================================

export type ThemeId =
  | "titanium-chalk"
  | "glacier-frost"
  | "obsidian-champagne"
  | "obsidian-ember";

export const VALID_THEMES: readonly ThemeId[] = [
  "titanium-chalk",
  "glacier-frost",
  "obsidian-champagne",
  "obsidian-ember",
] as const;

export function isValidTheme(theme: string | null | undefined): theme is ThemeId {
  return typeof theme === "string" && (VALID_THEMES as readonly string[]).includes(theme);
}

export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  mode: "light" | "dark";
  description: string;
  primaryColor: string;
  primaryHover: string;
  bgTone: string;
  swatchColors: [string, string]; // [surface, accent]
  overlayCss: string;
  radialGlow: string;
  sidebarBg: string;
  sidebarAccent: string;
  sidebarForeground: string;
  sidebarMuted: string;
}

export const THEME_LIST: ThemeMetadata[] = [
  {
    id: "titanium-chalk",
    name: "Titanium Chalk",
    mode: "light",
    description: "Crisp architectural chalk-white with sharp zinc contrast (Default Light).",
    primaryColor: "#18181B",
    primaryHover: "#27272A",
    bgTone: "#F8F9FA",
    swatchColors: ["#FFFFFF", "#18181B"],
    overlayCss:
      "linear-gradient(135deg, #F4F5F7 0%, #F8F9FA 52%, #F1F3F5 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(24, 24, 27, 0.03) 0%, transparent 60%)",
    sidebarBg: "#18181B",
    sidebarAccent: "#3F3F46",
    sidebarForeground: "#FFFFFF",
    sidebarMuted: "#D4D4D8",
  },
  {
    id: "glacier-frost",
    name: "Glacier Frost",
    mode: "light",
    description: "Clean, crisp sapphire & glacier-white SaaS.",
    primaryColor: "#2563EB",
    primaryHover: "#1D4ED8",
    bgTone: "#DCEAF7",
    swatchColors: ["#FFFFFF", "#2563EB"],
    overlayCss:
      "radial-gradient(circle at 85% 10%, rgba(37, 99, 235, 0.08), transparent 45%), linear-gradient(135deg, #D4E5F5 0%, #E4EFF9 52%, #CFE2F3 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.06) 0%, transparent 60%)",
    sidebarBg: "#10243E",
    sidebarAccent: "#234C78",
    sidebarForeground: "#FFFFFF",
    sidebarMuted: "#BFDBFE",
  },
  {
    id: "obsidian-champagne",
    name: "Obsidian Champagne",
    mode: "dark",
    description: "Premium, elegant dark luxury with warm champagne gold.",
    primaryColor: "#C9A66B",
    primaryHover: "#B89455",
    bgTone: "#171717",
    swatchColors: ["#242424", "#C9A66B"],
    overlayCss:
      "radial-gradient(circle at top right, rgba(201, 166, 107, 0.14), transparent 50%), linear-gradient(180deg, #171717 0%, #1F1F1F 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(201, 166, 107, 0.08) 0%, transparent 60%)",
    sidebarBg: "#0D0D0D",
    sidebarAccent: "#383024",
    sidebarForeground: "#F5F5F4",
    sidebarMuted: "#A8A29E",
  },
  {
    id: "obsidian-ember",
    name: "Obsidian Ember",
    mode: "dark",
    description: "Deep obsidian charcoal with high-contrast ember orange accents.",
    primaryColor: "#FF6500",
    primaryHover: "#FF8533",
    bgTone: "#121212",
    swatchColors: ["#1C1C1C", "#FF6500"],
    overlayCss:
      "linear-gradient(180deg, #121212 0%, #161616 100%)",
    radialGlow: "none",
    sidebarBg: "#090909",
    sidebarAccent: "#332013",
    sidebarForeground: "#FAFAFA",
    sidebarMuted: "#A1A1AA",
  },
];

export const THEMES_BY_ID: Record<ThemeId, ThemeMetadata> = THEME_LIST.reduce(
  (acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  },
  {} as Record<ThemeId, ThemeMetadata>
);

export const DEFAULT_THEME_ID: ThemeId = "titanium-chalk";
