// ============================================================================
// GymApra V2 — 4-Theme Central Configuration Engine
// ============================================================================

export type ThemeId =
  | "alpine-jade"
  | "glacier-slate"
  | "obsidian-champagne"
  | "arctic-titanium";

export const VALID_THEMES: readonly ThemeId[] = [
  "alpine-jade",
  "glacier-slate",
  "obsidian-champagne",
  "arctic-titanium",
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
  bgTone: string;
  swatchColors: [string, string]; // [surface, accent]
  overlayCss: string;
  radialGlow: string;
}

export const THEME_LIST: ThemeMetadata[] = [
  {
    id: "alpine-jade",
    name: "Alpine Jade",
    mode: "light",
    description: "Fresh, natural, green/teal identity.",
    primaryColor: "#0F766E",
    bgTone: "#E2F1EA",
    swatchColors: ["#FFFFFF", "#0F766E"],
    overlayCss:
      "radial-gradient(circle at 85% 10%, rgba(15, 118, 110, 0.08), transparent 45%), linear-gradient(135deg, #D9EEE4 0%, #E7F4EE 52%, #D4EAE0 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(15, 118, 110, 0.06) 0%, transparent 60%)",
  },
  {
    id: "glacier-slate",
    name: "Glacier Slate",
    mode: "light",
    description: "Clean, professional, high-trust SaaS.",
    primaryColor: "#2563EB",
    bgTone: "#E1ECF8",
    swatchColors: ["#FFFFFF", "#2563EB"],
    overlayCss:
      "radial-gradient(circle at 85% 10%, rgba(37, 99, 235, 0.08), transparent 45%), linear-gradient(135deg, #D9E7F6 0%, #E8F1FA 52%, #D4E3F4 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.06) 0%, transparent 60%)",
  },
  {
    id: "obsidian-champagne",
    name: "Obsidian Champagne",
    mode: "dark",
    description: "Premium, elegant, dark luxury.",
    primaryColor: "#D49B35",
    bgTone: "#090B0F",
    swatchColors: ["#12151C", "#D49B35"],
    overlayCss:
      "radial-gradient(circle at top right, rgba(212, 155, 53, 0.14), transparent 50%), linear-gradient(180deg, #090B0F 0%, #0D1016 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(212, 155, 53, 0.08) 0%, transparent 60%)",
  },
  {
    id: "arctic-titanium",
    name: "Arctic Titanium",
    mode: "dark",
    description: "Cool, modern, technology-inspired.",
    primaryColor: "#2563EB",
    bgTone: "#08111E",
    swatchColors: ["#0F1C2E", "#2563EB"],
    overlayCss:
      "radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 50%), linear-gradient(180deg, #08111E 0%, #0B1626 100%)",
    radialGlow:
      "radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.08) 0%, transparent 60%)",
  },
];

export const THEMES_BY_ID: Record<ThemeId, ThemeMetadata> = THEME_LIST.reduce(
  (acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  },
  {} as Record<ThemeId, ThemeMetadata>
);

export const DEFAULT_THEME_ID: ThemeId = "obsidian-champagne";
