import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LogOut, Plus, MapPin } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { GymApraLogo } from "@/components/ui/gymapra-logo";

interface GymSummary {
  id: string;
  name: string;
  address?: string | null;
}

interface AccountWithGyms {
  id: string;
  gyms: GymSummary[] | GymSummary | null;
}

interface StaffRoleEntry {
  gym_id: string;
  role: string;
  gyms: GymSummary | null;
}

interface MemberPortalEntry {
  id: string;
  full_name: string;
  branch_id: string;
  branches: {
    id: string;
    name: string;
    gym_id: string;
    gyms: {
      id: string;
      name: string;
    } | null;
  } | null;
}

const THUMBNAIL_IMAGES = [
  "/images/gym-thumb-1.jpg",
  "/images/gym-thumb-2.jpg",
  "/images/gym-thumb-3.jpg",
];

export default async function SelectWorkspacePage() {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // 1. Fetch gyms owned directly via accounts table
  const { data: ownedAccounts } = await supabase
    .from("accounts")
    .select("id, gyms ( id, name, address )")
    .eq("owner_id", user.id);

  // 2. Fetch staff gyms safely
  const { data: rawStaffRoles } = await supabase
    .from("gym_users")
    .select("role, gym_id, gyms ( id, name, address )")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Merge owned gyms and staff roles
  const staffRolesMap = new Map<string, StaffRoleEntry>();

  // Add owned gyms first with role = 'owner'
  const accounts = (ownedAccounts || []) as unknown as AccountWithGyms[];
  accounts.forEach((acc) => {
    const gymsList = Array.isArray(acc.gyms) ? acc.gyms : acc.gyms ? [acc.gyms] : [];
    gymsList.forEach((g) => {
      staffRolesMap.set(g.id, {
        gym_id: g.id,
        role: "owner",
        gyms: g,
      });
    });
  });

  // Add any additional staff roles
  const staffItems = (rawStaffRoles || []) as unknown as StaffRoleEntry[];
  staffItems.forEach((item) => {
    if (!staffRolesMap.has(item.gym_id)) {
      staffRolesMap.set(item.gym_id, item);
    }
  });

  const staffRoles = Array.from(staffRolesMap.values());

  // Fetch member portals
  const { data: rawMemberPortals } = await supabase
    .from("members")
    .select("id, full_name, branch_id, branches ( id, name, gym_id, gyms ( id, name ) )")
    .eq("user_id", user.id)
    .eq("status", "active");

  const memberPortals = (rawMemberPortals || []) as unknown as MemberPortalEntry[];
  const validMemberPortals = memberPortals.filter((m) => Boolean(m.branches?.gym_id));

  // =========================================================================
  // SINGLE-WORKSPACE ACCOUNTS MUST BYPASS THE WORKSPACE SELECTOR
  // =========================================================================
  // 1. Exactly one staff/owner gym and zero member portals -> direct to staff dashboard
  if (staffRoles.length === 1 && validMemberPortals.length === 0) {
    redirect(`/app/${staffRoles[0].gym_id}/dashboard`);
  }

  // 2. Exactly zero staff gyms and one member portal -> direct to member portal
  if (staffRoles.length === 0 && validMemberPortals.length === 1) {
    const targetGymId = validMemberPortals[0].branches?.gym_id;
    if (targetGymId) {
      redirect(`/portal/${targetGymId}/dashboard`);
    }
  }

  let thumbCounter = 0;

  return (
    <div className="min-h-screen bg-[#DCEAF7] relative flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8 selection:bg-[#2563EB] selection:text-white">
      {/* Desktop Photographic Backdrop (lg+) */}
      <div className="hidden lg:block absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/auth-gym-interior.jpg"
          alt="Gym interior backdrop"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center filter blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#10243E]/92 via-[#10243E]/85 to-[#0B1528]/95" />
      </div>

      {/* Mobile Photographic Header (< lg) */}
      <div className="relative h-40 sm:h-44 w-full lg:hidden overflow-hidden flex flex-col justify-between p-4 sm:p-5 shrink-0">
        <Image
          src="/images/auth-gym-interior.jpg"
          alt="Gym interior backdrop"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#10243E]/90 via-[#10243E]/75 to-[#10243E]/95" />

        <div className="relative z-10">
          <GymApraLogo variant="white" size="sm" />
        </div>

        <div className="relative z-10 pb-2">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
            Choose your workspace
          </h1>
          <p className="text-[11px] sm:text-xs text-blue-100/90 mt-0.5 font-normal">
            Select where you want to continue.
          </p>
        </div>

        {/* 3D Wave Transition into White Card */}
        <svg
          className="absolute bottom-0 left-0 w-full h-8 sm:h-9 pointer-events-none z-10"
          viewBox="0 0 500 80"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,35 C150,75 350,5 500,45 L500,80 L0,80 Z"
            fill="rgba(56, 189, 248, 0.45)"
          />
          <path
            d="M0,50 C180,20 320,65 500,40 L500,80 L0,80 Z"
            fill="rgba(37, 99, 235, 0.75)"
          />
          <path
            d="M0,62 C160,35 340,70 500,55 L500,80 L0,80 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* Main Selection Card Container */}
      <div className="w-full max-w-[440px] bg-white rounded-t-2xl sm:rounded-2xl -mt-3.5 lg:mt-0 p-4 sm:p-6 border-0 sm:border sm:border-[#B8D0E6]/80 shadow-xl relative z-10 flex-1 sm:flex-initial flex flex-col my-auto">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-4">
          <div className="mb-3">
            <GymApraLogo variant="dark" size="sm" />
          </div>
          <h1 className="text-xl font-black text-[#10243E] tracking-tight">
            Choose your workspace
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Select where you want to continue. Logged in as{" "}
            <span className="font-semibold text-[#10243E]">{user.email}</span>
          </p>
        </div>

        {/* Workspaces List */}
        <div className="space-y-2.5 flex-1">
          {/* Staff & Admin Workspaces */}
          {staffRoles.map((item) => {
            const thumb = THUMBNAIL_IMAGES[thumbCounter++ % THUMBNAIL_IMAGES.length];
            const isOwner = item.role.toLowerCase() === "owner";
            const roleLabel = isOwner ? "👑 Owner" : `👤 ${item.role.charAt(0).toUpperCase() + item.role.slice(1)}`;

            return (
              <Link
                key={item.gym_id}
                href={`/app/${item.gym_id}/dashboard`}
                className="group flex items-center justify-between p-3 rounded-xl border border-[#B8D0E6]/70 bg-white hover:border-[#2563EB] hover:bg-blue-50/20 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-[#B8D0E6]/60">
                    <Image
                      src={thumb}
                      alt={item.gyms?.name || "Gym workspace"}
                      fill
                      sizes="44px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#2563EB] block">
                      Gym Dashboard
                    </span>
                    <h3 className="font-bold text-[#10243E] text-xs sm:text-sm group-hover:text-[#2563EB] transition-colors truncate">
                      {item.gyms?.name || "Gym Workspace"}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] truncate">
                        <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                        {item.gyms?.address || "Main Branch"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200/60 shrink-0">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            );
          })}

          {/* Member Portals */}
          {validMemberPortals.map((m) => {
            const thumb = THUMBNAIL_IMAGES[thumbCounter++ % THUMBNAIL_IMAGES.length];
            const gymId = m.branches?.gym_id;
            const gymName = m.branches?.gyms?.name || "Gym";
            const branchName = m.branches?.name || "Main Branch";

            return (
              <Link
                key={m.id}
                href={`/portal/${gymId}/dashboard`}
                className="group flex items-center justify-between p-3 rounded-xl border border-[#B8D0E6]/70 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-[#B8D0E6]/60">
                    <Image
                      src={thumb}
                      alt={gymName}
                      fill
                      sizes="44px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 block">
                      Member Portal
                    </span>
                    <h3 className="font-bold text-[#10243E] text-xs sm:text-sm group-hover:text-emerald-600 transition-colors truncate">
                      {gymName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] truncate">
                        <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                        {branchName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                        👤 Member
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            );
          })}

          {/* Empty State */}
          {staffRoles.length === 0 && validMemberPortals.length === 0 && (
            <div className="text-center py-6 text-[#64748B] text-xs">
              <p className="mb-1 text-[#10243E] font-bold text-sm">No active gym workspaces found.</p>
              <p className="text-xs text-[#64748B] mb-4">
                Set up your gym workspace with your main branch to get started.
              </p>
              <div>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Create a new gym workspace
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3.5 border-t border-[#B8D0E6]/50 flex items-center justify-between">
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#64748B] hover:text-[#10243E] px-2.5 py-1 rounded-lg border border-[#B8D0E6] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </form>

          {(staffRoles.length > 0 || validMemberPortals.length > 0) && (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors"
            >
              <Plus className="w-3 h-3" /> New workspace
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
