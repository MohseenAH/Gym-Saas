"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();
  const drawerOpenRef = useRef(mobileDrawerOpen);

  useEffect(() => {
    drawerOpenRef.current = mobileDrawerOpen;
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (gymId && typeof document !== "undefined") {
      document.cookie = `gymapra_last_gym_id=${gymId}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [gymId]);

  // Dashboard-First Mobile & PWA Back Navigation (no double-back timer or exit toast)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalonePWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;

    if (!isStandalonePWA && !isMobileViewport) return;

    const dashboardPath = `/app/${gymId}/dashboard`;
    const primaryPaths = new Set([
      `/app/${gymId}/dashboard`,
      `/app/${gymId}/members`,
      `/app/${gymId}/memberships`,
      `/app/${gymId}/attendance`,
      `/app/${gymId}/payments`,
      `/app/${gymId}/expenses`,
      `/app/${gymId}/reports`,
      `/app/${gymId}/follow-ups`,
      `/app/${gymId}/staff`,
      `/app/${gymId}/branches`,
      `/app/${gymId}/notices`,
      `/app/${gymId}/settings`,
    ]);

    function handlePopState() {
      // 1. Close mobile drawer if open
      if (drawerOpenRef.current) {
        setMobileDrawerOpen(false);
        window.history.pushState({ gymapraOverlayGuard: true }, "");
        return;
      }

      // 2. Close active modal/dialog if open
      const openDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (openDialog) {
        const closeBtn = openDialog.querySelector<HTMLButtonElement>(
          'button[aria-label*="Close" i], button[aria-label*="Dismiss" i]'
        );
        if (closeBtn) {
          closeBtn.click();
        } else {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        }
        window.history.pushState({ gymapraOverlayGuard: true }, "");
        return;
      }

      // 3. Preserve unsaved form protection
      const unsavedForm = document.querySelector(
        'form[data-dirty="true"], [data-unsaved="true"]'
      );
      if (unsavedForm) {
        return;
      }

      if (!isStandalonePWA) return;

      // 4. Dashboard-first back navigation in installed PWA:
      //    Back from any non-dashboard primary tab returns directly to Dashboard.
      //    Back from Dashboard allows normal platform exit behaviour without trapping.
      if (pathname !== dashboardPath && primaryPaths.has(pathname)) {
        router.replace(dashboardPath);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [gymId, pathname, router]);

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
