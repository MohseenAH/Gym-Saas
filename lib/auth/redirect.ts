import { createClient, getCachedUser } from "@/lib/supabase/server";

export interface PersonaDestination {
  path: string;
  type: "staff" | "member" | "selector" | "onboarding";
}

/**
 * Deterministic redirect helper:
 * - 0 gyms and no member profile -> /onboarding
 * - Owner/staff of exactly 1 gym -> /app/[gymId]/dashboard (skips /select-workspace)
 * - Owner/staff of >1 gym -> /select-workspace
 * - Only a gym member (1 gym) -> /portal/[gymId]/dashboard
 * - Member of >1 gym -> /select-workspace
 */
export async function resolvePostLoginRedirect(): Promise<PersonaDestination> {
  const supabase = await createClient();
  const user = await getCachedUser();

  if (!user) {
    return { path: "/login", type: "onboarding" };
  }

  // Parallel fetch: owned gyms, staff gyms, and member profiles
  const [ownedAccountsRes, rawStaffRes, memberProfilesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, gyms ( id, name )")
      .eq("owner_id", user.id),
    supabase
      .from("gym_users")
      .select("gym_id, role, gyms ( id, name )")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("members")
      .select("id, branch_id, branches ( id, gym_id, gyms ( id, name ) )")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  interface GymItem {
    id: string;
    name: string;
  }
  interface AccountWithGyms {
    id: string;
    gyms?: GymItem[] | GymItem | null;
  }
  interface StaffEntry {
    gym_id: string;
    role: string;
    gyms?: GymItem | null;
  }

  const staffMap = new Map<string, StaffEntry>();

  const accounts = (ownedAccountsRes.data || []) as unknown as AccountWithGyms[];
  accounts.forEach((acc) => {
    const list = Array.isArray(acc.gyms) ? acc.gyms : acc.gyms ? [acc.gyms] : [];
    list.forEach((g) => {
      staffMap.set(g.id, { gym_id: g.id, role: "owner", gyms: g });
    });
  });

  const staffItems = (rawStaffRes.data || []) as unknown as StaffEntry[];
  staffItems.forEach((item) => {
    if (!staffMap.has(item.gym_id)) {
      staffMap.set(item.gym_id, item);
    }
  });

  const staffList = Array.from(staffMap.values());
  const memberList = memberProfilesRes.data || [];

  // Rule 1: Owner or staff of exactly 1 gym -> straight to /app/[gymId]/dashboard
  if (staffList.length === 1) {
    return {
      path: `/app/${staffList[0].gym_id}/dashboard`,
      type: "staff",
    };
  }

  // Rule 2: Owner or staff of >1 gym -> /select-workspace
  if (staffList.length > 1) {
    return { path: "/select-workspace", type: "selector" };
  }

  // Rule 3: Only a gym member
  if (memberList.length === 1) {
    const branches = memberList[0].branches as unknown as { gym_id?: string } | null;
    const gymId = branches?.gym_id;
    if (gymId) {
      return {
        path: `/portal/${gymId}/dashboard`,
        type: "member",
      };
    }
  }

  if (memberList.length > 1) {
    return { path: "/select-workspace", type: "selector" };
  }

  // Rule 4: Authenticated user with 0 gyms and no member profile -> /onboarding
  return { path: "/onboarding", type: "onboarding" };
}
