"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { StaffRole } from "@/lib/auth/roles";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import {
  LayoutDashboard,
  Users,
  IdCard,
  CalendarCheck,
  Receipt,
  TrendingDown,
  FileSpreadsheet,
  ShieldCheck,
  Building2,
  Bell,
  Settings,
  Dumbbell,
  ArrowLeftRight,
  Compass,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  capability?: Capability;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface Branch {
  id: string;
  name: string;
}

interface SidebarProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  branches?: Branch[];
  onNavigate?: () => void;
}

export function Sidebar({ gymId, gymName, role, branches = [], onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentBranchId = searchParams.get("branchId");

  function handleBranchChange(newBranchId: string | null) {
    const cookieName = `gymapra_branch_${gymId}`;
    if (!newBranchId || newBranchId === "all") {
      document.cookie = `${cookieName}=; path=/; max-age=0`;
    } else {
      document.cookie = `${cookieName}=${newBranchId}; path=/; max-age=31536000; SameSite=Lax`;
    }

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

  const navGroups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: `/app/${gymId}/dashboard`,
          icon: LayoutDashboard,
        },
        {
          label: "Getting Started",
          href: `/app/${gymId}/getting-started`,
          icon: Compass,
        },
      ],
    },
    {
      title: "Gym Operations",
      items: [
        {
          label: "Members",
          href: `/app/${gymId}/members`,
          icon: Users,
          capability: "members:view",
        },
        {
          label: "Memberships",
          href: `/app/${gymId}/memberships`,
          icon: IdCard,
          capability: "members:view",
        },
        {
          label: "Attendance",
          href: `/app/${gymId}/attendance`,
          icon: CalendarCheck,
          capability: "attendance:record",
        },
      ],
    },
    {
      title: "Finance & Insights",
      items: [
        {
          label: "Payments",
          href: `/app/${gymId}/payments`,
          icon: Receipt,
          capability: "payments:record",
        },
        {
          label: "Expenses",
          href: `/app/${gymId}/expenses`,
          icon: TrendingDown,
          capability: "expenses:manage",
        },
        {
          label: "Reports",
          href: `/app/${gymId}/reports`,
          icon: FileSpreadsheet,
          capability: "reports:view",
        },
      ],
    },
    {
      title: "Gym Management",
      items: [
        {
          label: "Staff & Team",
          href: `/app/${gymId}/staff`,
          icon: ShieldCheck,
          capability: "staff:manage",
        },
        {
          label: "Branches",
          href: `/app/${gymId}/branches`,
          icon: Building2,
          capability: "branches:manage",
        },
        {
          label: "Notices",
          href: `/app/${gymId}/notices`,
          icon: Bell,
          capability: "notices:view",
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          label: "Settings",
          href: `/app/${gymId}/settings`,
          icon: Settings,
          capability: "settings:manage",
        },
      ],
    },
  ];

  // Find which group contains the currently active route
  const activeGroupTitle = useMemo(() => {
    for (const group of navGroups) {
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      );
      if (hasActive) return group.title;
    }
    return null;
  }, [pathname, navGroups]);

  // Track accordion expand/collapse state per group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      );
      initial[group.title] = hasActive;
    });
    // Fallback: If no group matches active route, default Overview to open
    if (!Object.values(initial).some(Boolean)) {
      initial["Overview"] = true;
    }
    return initial;
  });

  const lastActiveGroupRef = useRef<string | null>(null);

  // Auto-expand category group when navigating to a new route in that category
  useEffect(() => {
    if (activeGroupTitle && activeGroupTitle !== lastActiveGroupRef.current) {
      lastActiveGroupRef.current = activeGroupTitle;
      setOpenGroups((prev) => ({
        ...prev,
        [activeGroupTitle]: true,
      }));
    }
  }, [activeGroupTitle]);

  function toggleGroup(title: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }

  return (
    <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col justify-between shrink-0 h-full text-card-foreground select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand / Gym Header */}
        <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-8 md:pr-0">
            <div className="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-xs shrink-0 flex items-center justify-center">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-foreground text-sm tracking-tight truncate leading-tight">
                {gymName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  {role}
                </span>
                <span className="inline-block w-1 h-1 rounded-full bg-border" />
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                  Pilot Pro
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Navigation Links (Collapsible Accordions) */}
        <nav className="p-3 space-y-2.5 overflow-y-auto flex-1">
          {navGroups.map((group) => {
            // Filter group items by role capabilities
            const visibleItems = group.items.filter((item) => {
              if (!item.capability) return true;
              return hasCapability(role, item.capability);
            });

            // Don't render empty section if role lacks access to all items
            if (visibleItems.length === 0) return null;

            const isOpen = Boolean(openGroups[group.title]);
            const isGroupActive = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
            );

            return (
              <div key={group.title} className="space-y-1">
                {/* Collapsible Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer select-none group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{group.title}</span>
                    {isGroupActive && !isOpen && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                        title="Active page inside"
                      />
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Collapsible Children with smooth transition */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="overflow-hidden space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const targetHref = currentBranchId
                        ? `${item.href}?branchId=${encodeURIComponent(currentBranchId)}`
                        : item.href;

                      return (
                        <Link
                          key={item.href}
                          href={targetHref}
                          prefetch={true}
                          onMouseEnter={() => router.prefetch(targetHref)}
                          onTouchStart={() => router.prefetch(targetHref)}
                          onClick={onNavigate}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/25 shadow-2xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Pinned Branch Switcher & Workspace Switcher Footer */}
      <div className="p-3 border-t border-border shrink-0 bg-card space-y-2">
        {branches.length > 1 ? (
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center justify-between">
              <span>Operating Branch</span>
              <Building2 className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="relative">
              <select
                value={currentBranchId || "all"}
                onChange={(e) => handleBranchChange(e.target.value === "all" ? null : e.target.value)}
                className="w-full h-9 pl-2.5 pr-7 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none truncate"
              >
                <option value="all">All Branches (Consolidated)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        ) : branches.length === 1 ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/50 border border-border text-xs font-semibold text-foreground">
            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{branches[0].name}</span>
          </div>
        ) : null}

        <Link
          href="/select-workspace"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/select-workspace")}
          onTouchStart={() => router.prefetch("/select-workspace")}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <ArrowLeftRight className="w-3 h-3" />
          <span>Switch Workspace</span>
        </Link>
      </div>
    </aside>
  );
}
