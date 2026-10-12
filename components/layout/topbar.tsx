"use client";

import { useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import {
  Building2,
  ChevronDown,
  LogOut,
  User,
  Plus,
  Menu,
} from "lucide-react";
import Link from "next/link";

interface Branch {
  id: string;
  name: string;
}

interface TopbarProps {
  gymId: string;
  branches: Branch[];
  currentBranchId?: string;
  userEmail: string;
  userName?: string;
  onMenuClick?: () => void;
}

export function Topbar({
  gymId,
  branches,
  currentBranchId,
  userEmail,
  userName,
  onMenuClick,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentBranch =
    branches.find((b) => b.id === currentBranchId) || branches[0];

  return (
    <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
      {/* Branch selector & Mobile Toggle */}
      <div className="flex items-center gap-2 md:gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {branches.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-[120px] sm:max-w-none">{currentBranch?.name || "Main Branch"}</span>
            {branches.length > 1 && <ChevronDown className="w-3 h-3 text-slate-400" />}
          </div>
        ) : null}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <Link
          href={`/app/${gymId}/members`}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Quick Member Add
        </Link>

        {/* User avatar & dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center border border-slate-200">
              {userName ? userName[0].toUpperCase() : userEmail[0].toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {userName || "Staff"}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {userEmail}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg p-1 z-50">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {userName || "Staff Member"}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {userEmail}
                </div>
              </div>

              <form action={logoutAction} className="mt-1">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
