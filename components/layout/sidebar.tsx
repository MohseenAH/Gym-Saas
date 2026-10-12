"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffRole } from "@/lib/auth/roles";
import { Capability, hasCapability } from "@/lib/auth/capabilities";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Building2,
  ShieldCheck,
  Settings,
  Dumbbell,
  Receipt,
  FileSpreadsheet,
  Bell,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  capability?: Capability;
}

interface SidebarProps {
  gymId: string;
  gymName: string;
  role: StaffRole;
  onNavigate?: () => void;
}

export function Sidebar({ gymId, gymName, role, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/app/${gymId}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: "Members",
      href: `/app/${gymId}/members`,
      icon: Users,
      capability: "members:view",
    },
    {
      label: "Attendance",
      href: `/app/${gymId}/attendance`,
      icon: CalendarCheck,
      capability: "attendance:record",
    },
    {
      label: "Payments",
      href: `/app/${gymId}/payments`,
      icon: CreditCard,
      capability: "payments:record",
    },
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
      label: "Expenses",
      href: `/app/${gymId}/expenses`,
      icon: Receipt,
      capability: "expenses:manage",
    },
    {
      label: "Notices",
      href: `/app/${gymId}/notices`,
      icon: Bell,
      capability: "notices:view",
    },
    {
      label: "Reports",
      href: `/app/${gymId}/reports`,
      icon: FileSpreadsheet,
      capability: "reports:view",
    },
    {
      label: "Settings",
      href: `/app/${gymId}/settings`,
      icon: Settings,
      capability: "settings:manage",
    },
  ];

  // Role-adaptive filtering: Only show routes the user is authorized to access
  const visibleItems = navItems.filter((item) => {
    if (!item.capability) return true;
    return hasCapability(role, item.capability);
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0">
      <div>
        {/* Brand / Gym Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
              {gymName}
            </div>
            <div className="text-[11px] font-medium text-slate-400 capitalize">
              {role} Workspace
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-indigo-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Switcher & Version */}
      <div className="p-4 border-t border-slate-100">
        <Link
          href="/select-workspace"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70 transition-all"
        >
          Switch Gym / Portal
        </Link>
        <div className="mt-2 text-center text-[10px] text-slate-400">
          GymApra OS v2.0
        </div>
      </div>
    </aside>
  );
}
