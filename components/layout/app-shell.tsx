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
  const [exitToastPath, setExitToastPath] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerOpenRef = useRef(mobileDrawerOpen);
  const exitToastVisible = exitToastPath === pathname;

  useEffect(() => {
    drawerOpenRef.current = mobileDrawerOpen;
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (gymId && typeof document !== "undefined") {
      document.cookie = `gymapra_last_gym_id=${gymId}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [gymId]);

  // Reset double-back-to-exit timer when navigating away from Dashboard
  useEffect(() => {
    const dashboardPath = `/app/${gymId}/dashboard`;
    if (pathname !== dashboardPath) {
      exitArmedRef.current = false;
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    }
  }, [pathname, gymId]);

  // Mobile & PWA Back Navigation + Double Back to Exit
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

    if (
      isStandalonePWA &&
      pathname === dashboardPath &&
      !window.history.state?.gymapraExitGuard
    ) {
      window.history.pushState({ gymapraExitGuard: true }, "");
    }

    function handlePopState() {
      // 1. Close mobile drawer if open
      if (drawerOpenRef.current) {
        setMobileDrawerOpen(false);
        window.history.pushState({ gymapraGuard: true }, "");
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
        window.history.pushState({ gymapraGuard: true }, "");
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

      // 4. On primary non-dashboard pages in installed PWA, back returns to Dashboard
      if (pathname !== dashboardPath && primaryPaths.has(pathname)) {
        router.replace(dashboardPath);
        return;
      }

      // 5. On Dashboard in installed PWA, implement double back to exit
      if (pathname === dashboardPath) {
        if (!exitArmedRef.current) {
          exitArmedRef.current = true;
          setExitToastPath(dashboardPath);
          window.history.pushState({ gymapraExitGuard: true }, "");
          if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
          exitTimerRef.current = setTimeout(() => {
            exitArmedRef.current = false;
            setExitToastPath(null);
            exitTimerRef.current = null;
          }, 2000);
        } else {
          // Second back press within 2s: allow normal platform exit
          exitArmedRef.current = false;
          setExitToastPath(null);
          if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current);
            exitTimerRef.current = null;
          }
        }
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
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

      {/* Double Back to Exit Toast (Installed Mobile PWA) */}
      {exitToastVisible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-xs font-semibold shadow-lg pointer-events-none animate-in fade-in duration-150 whitespace-nowrap"
        >
          Press back again to exit GymApra
        </div>
      )}
    </div>
  );
}
