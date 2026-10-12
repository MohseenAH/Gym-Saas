"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { StaffRole } from "@/lib/auth/roles";
import { X } from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface AppShellProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  branches: Branch[];
  userEmail: string;
  userName: string;
  children: React.ReactNode;
}

export function AppShell({
  gymId,
  gymName,
  role,
  branches,
  userEmail,
  userName,
  children,
}: AppShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar gymId={gymId} gymName={gymName} role={role} />
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-10 w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="absolute right-2 top-3 z-20">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Sidebar
              gymId={gymId}
              gymName={gymName}
              role={role}
              onNavigate={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          gymId={gymId}
          branches={branches}
          userEmail={userEmail}
          userName={userName}
          onMenuClick={() => setMobileDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
