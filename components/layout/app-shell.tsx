"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ThemedPageBackground } from "./themed-page-background";
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

  useEffect(() => {
    if (gymId && typeof document !== "undefined") {
      document.cookie = `gymapra_last_gym_id=${gymId}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [gymId]);

  return (
    <div className="relative min-h-screen bg-transparent text-foreground">
      {/* Dynamic Themed Background Layer */}
      <ThemedPageBackground />

      {/* Main App Container */}
      <div className="relative z-10 flex h-screen overflow-hidden bg-transparent">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden md:flex shrink-0">
          <Sidebar gymId={gymId} gymName={gymName} role={role} branches={branches} />
        </div>

        {/* Mobile Slide-Over Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
              onClick={() => setMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative z-10 w-72 max-w-[85vw] bg-card text-card-foreground h-full shadow-2xl flex flex-col border-r border-border animate-in slide-in-from-left duration-200">
              <div className="absolute right-3 top-3.5 z-20">
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Sidebar
                gymId={gymId}
                gymName={gymName}
                role={role}
                branches={branches}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-transparent">
          <Topbar
            gymId={gymId}
            gymName={gymName}
            role={role}
            branches={branches}
            userEmail={userEmail}
            userName={userName}
            onMenuClick={() => setMobileDrawerOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
