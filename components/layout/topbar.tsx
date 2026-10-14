"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { StaffRole, ROLE_LABELS } from "@/lib/auth/roles";
import {
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Menu,
  Settings,
  ArrowLeftRight,
  Check,
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
    <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left: Mobile Toggle & Branch Selector */}
      <div className="flex items-center gap-2 md:gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Branch Context Selector */}
        {branches.length === 1 ? (
          // Single-branch gym: Display clear static branch badge
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              {branches[0].name}
            </span>
          </div>
        ) : branches.length > 1 ? (
          // Multi-branch gym: Interactive branch dropdown
          <div className="relative" ref={branchMenuRef}>
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-xs font-semibold text-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-expanded={branchDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Select gym branch"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {isAllSelected
                  ? "All Branches (Org-wide)"
                  : selectedBranch?.name || "Select Branch"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  branchDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {branchDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150"
                role="listbox"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Operating Branch
                </div>

                {canSelectAll && (
                  <button
                    onClick={() => handleBranchChange(null)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      isAllSelected
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    role="option"
                    aria-selected={isAllSelected}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">All Branches (Consolidated)</span>
                    </div>
                    {isAllSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                )}

                <div className="my-1 border-t border-slate-100" />

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {branches.map((b) => {
                    const isSelected = activeBranchId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleBranchChange(b.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="truncate">{b.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
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
      <div className="flex items-center gap-3">
        <Link
          href={`/app/${gymId}/members`}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Quick Member Add
        </Link>

        {/* User Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="User account menu"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200/60 shadow-xs">
              {avatarLetter}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {userName || "Staff Member"}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                {userEmail}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200/90 shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150"
              role="menu"
            >
              {/* User Identity Header */}
              <div className="px-3 py-2.5 bg-slate-50/70 rounded-xl mb-1 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {userName || "Gym Staff"}
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                    {roleLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {userEmail}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                  <Building2 className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span className="truncate">{gymName}</span>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="space-y-0.5">
                <Link
                  href={`/app/${gymId}/settings`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                  role="menuitem"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Account & Settings</span>
                </Link>

                <Link
                  href="/select-workspace"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                  role="menuitem"
                >
                  <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                  <span>Switch Workspace</span>
                </Link>
              </div>

              <div className="my-1 border-t border-slate-100" />

              {/* Sign Out Action */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
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
