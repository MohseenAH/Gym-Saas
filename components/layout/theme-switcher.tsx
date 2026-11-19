"use client";

import { useState, useRef, useEffect } from "react";
import { useGymTheme } from "@/lib/theme";
import { THEME_LIST, ThemeId } from "@/lib/themes/theme-config";
import { Palette, Check, ChevronDown } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, changeTheme, currentThemeMetadata } = useGymTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all shadow-2xs hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
        aria-label="Change theme"
        aria-expanded={open}
        aria-haspopup="true"
        title={`Current Theme: ${currentThemeMetadata.name}`}
      >
        <Palette className="w-3.5 h-3.5 text-primary shrink-0" />

        {/* Dual-Color Swatch Preview */}
        <span
          className="w-4 h-4 rounded-full border border-border/80 flex items-center justify-center shrink-0 shadow-2xs"
          style={{ backgroundColor: currentThemeMetadata.swatchColors[0] }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentThemeMetadata.swatchColors[1] }}
          />
        </span>

        <span className="hidden lg:inline font-semibold text-xs text-foreground truncate max-w-[120px]">
          {currentThemeMetadata.name}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card shadow-2xl p-1.5 z-50 text-card-foreground animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1 flex items-center justify-between">
            <span>Select Aesthetic</span>
            <span className="text-[10px] font-mono text-primary lowercase">
              {currentThemeMetadata.mode}
            </span>
          </div>

          <div className="space-y-1">
            {THEME_LIST.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    changeTheme(t.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30 text-foreground font-semibold shadow-2xs"
                      : "hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Dual-Color Swatch Dot */}
                    <div
                      className="w-5 h-5 rounded-full border border-border/80 flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: t.swatchColors[0] }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: t.swatchColors[1] }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.mode === "light" ? "Light SaaS" : "Dark Luxury"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        t.mode === "dark"
                          ? "bg-slate-800 text-slate-200 border border-slate-700"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {t.mode}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
