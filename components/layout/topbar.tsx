"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { StaffRole, ROLE_LABELS } from "@/lib/auth/roles";
import { GymTheme, THEME_CONFIGS, useGymTheme } from "@/lib/theme";
import {
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Menu,
  Settings,
  ArrowLeftRight,
  Check,
  Palette,
} from "lucide-react";
import Link from "next/link";

interface Branch {
  id: string;
  name: string;
}

interface TopbarProps {
  gymId: string;
  gymName: string;
  branches: Branch[];
  currentBranchId?: string | null;
  role: StaffRole;
  userEmail: string;
  userName?: string;
  onMenuClick?: () => void;
}

export function Topbar({
  gymId,
  gymName,
  branches,
  currentBranchId: initialBranchId,
  role,
  userEmail,
  userName,
  onMenuClick,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, changeTheme } = useGymTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
      if (
        branchMenuRef.current &&
        !branchMenuRef.current.contains(event.target as Node)
      ) {
        setBranchDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setBranchDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Determine active branch: URL searchParam takes priority, followed by initialBranchId
  const urlBranchId = searchParams.get("branchId");
  const activeBranchId = urlBranchId !== null ? urlBranchId : initialBranchId || null;

  const canSelectAll = role === "owner" || role === "partner" || role === "manager";
  const selectedBranch = branches.find((b) => b.id === activeBranchId);
  const isAllSelected = !activeBranchId || activeBranchId === "all";

  function handleBranchChange(newBranchId: string | null) {
    setBranchDropdownOpen(false);

    // Persist to cookie for refresh and cross-session retention
    const cookieName = `gymapra_branch_${gymId}`;
    if (!newBranchId || newBranchId === "all") {
      document.cookie = `${cookieName}=; path=/; max-age=0`;
    } else {
      document.cookie = `${cookieName}=${newBranchId}; path=/; max-age=31536000; SameSite=Lax`;
    }

    // Update query params on current page
    const params = new URLSearchParams(searchParams.toString());
    if (!newBranchId || newBranchId === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", newBranchId);
    }

    const newQuery = params.toString();
    const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
    router.push(targetUrl);
    router.refresh();
  }

  const roleLabel = ROLE_LABELS[role] || "Staff";
  const avatarLetter = userName
    ? userName[0].toUpperCase()
    : userEmail
    ? userEmail[0].toUpperCase()
    : "U";

  return (
    <header className="h-16 px-4 md:px-6 backdrop-blur-md bg-card/85 border-b border-border flex items-center justify-between shrink-0 sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Toggle & Branch Selector */}
      <div className="flex items-center gap-2 md:gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Branch Context Selector */}
        {branches.length === 1 ? (
          // Single-branch gym: Display clear static branch badge
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              {branches[0].name}
            </span>
          </div>
        ) : branches.length > 1 ? (
          // Multi-branch gym: Interactive branch dropdown
          <div className="relative" ref={branchMenuRef}>
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground transition-all focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              aria-expanded={branchDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Select gym branch"
            >
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {isAllSelected
                  ? "All Branches (Org-wide)"
                  : selectedBranch?.name || "Select Branch"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                  branchDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {branchDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-64 bg-card rounded-xl border border-border shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 text-card-foreground"
                role="listbox"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Select Operating Branch
                </div>

                {canSelectAll && (
                  <button
                    onClick={() => handleBranchChange(null)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      isAllSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                    role="option"
                    aria-selected={isAllSelected}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">All Branches (Consolidated)</span>
                    </div>
                    {isAllSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                )}

                <div className="my-1 border-t border-border" />

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {branches.map((b) => {
                    const isSelected = activeBranchId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleBranchChange(b.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="truncate">{b.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Right: Quick Action & User Profile Dropdown */}
      <div className="flex items-center gap-2.5 md:gap-3">
        <Link
          href={`/app/${gymId}/members`}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-semibold text-xs shadow-xs transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Quick Member Add
        </Link>

        {/* User Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="User account menu"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shadow-2xs">
              {avatarLetter}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-foreground leading-tight">
                {userName || "Staff Member"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                {userEmail}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 bg-card rounded-2xl border border-border shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150 text-card-foreground"
              role="menu"
            >
              {/* User Identity Header */}
              <div className="px-3 py-2.5 bg-muted/60 rounded-xl mb-1.5 border border-border">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground truncate">
                    {userName || "Gym Staff"}
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wider">
                    {roleLabel}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {userEmail}
                </div>
                <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-[10px] text-foreground/80 font-medium">
                  <Building2 className="w-3 h-3 text-primary shrink-0" />
                  <span className="truncate">{gymName}</span>
                </div>
              </div>

              {/* Theme Switcher Widget */}
              <div className="px-2 py-1.5 mb-1 bg-muted/30 rounded-xl border border-border/60">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  <div className="flex items-center gap-1">
                    <Palette className="w-3 h-3 text-primary" /> Gym Theme
                  </div>
                  <span className="capitalize text-primary font-semibold">{theme}</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(["light", "dark", "iron", "sage"] as GymTheme[]).map((t) => {
                    const cfg = THEME_CONFIGS[t];
                    const isCurrent = theme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => changeTheme(t)}
                        title={cfg.label}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-semibold flex flex-col items-center gap-1 transition-all border ${
                          isCurrent
                            ? "border-primary bg-primary/10 text-primary shadow-2xs"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: cfg.primaryColor }}
                        />
                        <span className="capitalize truncate w-full text-center">
                          {t}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="space-y-0.5">
                <Link
                  href={`/app/${gymId}/settings`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  role="menuitem"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>Account & Settings</span>
                </Link>

                <Link
                  href="/select-workspace"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  role="menuitem"
                >
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  <span>Switch Workspace</span>
                </Link>
              </div>

              <div className="my-1 border-t border-border" />

              {/* Sign Out Action */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-500/10 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
