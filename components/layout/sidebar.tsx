"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

interface SidebarProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  onNavigate?: () => void;
}

export function Sidebar({ gymId, gymName, role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentBranchId = searchParams.get("branchId");

  const navGroups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: `/app/${gymId}/dashboard`,
          icon: LayoutDashboard,
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

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-full">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand / Gym Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="font-black text-slate-900 text-sm tracking-tight truncate">
              {gymName}
            </div>
            <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
              {role} Workspace
            </div>
          </div>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="p-3 space-y-4 overflow-y-auto flex-1">
          {navGroups.map((group) => {
            // Filter group items by role capabilities
            const visibleItems = group.items.filter((item) => {
              if (!item.capability) return true;
              return hasCapability(role, item.capability);
            });

            // Don't render empty section if role lacks access to all items
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {group.title}
                </div>
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
                      onClick={onNavigate}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-bold shadow-xs border border-indigo-100/60"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Switcher & Version Footer */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <Link
          href="/select-workspace"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 transition-all shadow-2xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
          <span>Switch Workspace</span>
        </Link>
        <div className="mt-2 text-center text-[10px] text-slate-400 font-medium">
          GymApra OS &bull; V2.0 Production
        </div>
      </div>
    </aside>
  );
}
