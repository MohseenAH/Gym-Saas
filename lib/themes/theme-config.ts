// ============================================================================
// GymApra V2 — 4-Theme Central Configuration Engine
// ============================================================================

export type ThemeId =
  | "emerald-mist"
  | "glacier-frost"
  | "obsidian-champagne"
  | "electric-sapphire";

export const VALID_THEMES: readonly ThemeId[] = [
  "emerald-mist",
  "glacier-frost",
  "obsidian-champagne",
  "electric-sapphire",
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
    id: "emerald-mist",
    name: "Emerald Mist",
    mode: "light",
    description: "Fresh, natural emerald & mist-white identity (Default Light).",
    primaryColor: "#059669",
    primaryHover: "#047857",
    bgTone: "#DDEFE6",
    swatchColors: ["#FFFFFF", "#059669"],
    overlayCss:
      "radial-gradient(circle at 85% 10%, rgba(5, 150, 105, 0.08), transparent 45%), linear-gradient(135deg, #D5EBE0 0%, #E3F2EB 52%, #D0E7DC 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(5, 150, 105, 0.06) 0%, transparent 60%)",
    sidebarBg: "#064E3B",
    sidebarAccent: "#126C54",
    sidebarForeground: "#FFFFFF",
    sidebarMuted: "#A7F3D0",
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
    id: "electric-sapphire",
    name: "Electric Sapphire",
    mode: "dark",
    description: "Cool, high-energy deep sapphire with vivid electric blue.",
    primaryColor: "#3B82F6",
    primaryHover: "#2563EB",
    bgTone: "#080F24",
    swatchColors: ["#111D38", "#3B82F6"],
    overlayCss:
      "radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 50%), linear-gradient(180deg, #080F24 0%, #0D1735 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 60%)",
    sidebarBg: "#060B19",
    sidebarAccent: "#1D4ED8",
    sidebarForeground: "#F1F6FF",
    sidebarMuted: "#94A8C7",
  },
];

export const THEMES_BY_ID: Record<ThemeId, ThemeMetadata> = THEME_LIST.reduce(
  (acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  },
  {} as Record<ThemeId, ThemeMetadata>
);

export const DEFAULT_THEME_ID: ThemeId = "emerald-mist";
