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
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar gymId={gymId} gymName={gymName} role={role} />
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
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background">
        <Topbar
          gymId={gymId}
          gymName={gymName}
          role={role}
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
