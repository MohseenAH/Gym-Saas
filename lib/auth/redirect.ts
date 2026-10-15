import { createClient, getCachedUser, CachedUser } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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
export async function resolvePostLoginRedirect(
  client?: SupabaseClient,
  currentUser?: CachedUser | null
): Promise<PersonaDestination> {
  const supabase = client || (await createClient());
  const user = currentUser !== undefined ? currentUser : await getCachedUser();

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
  for (const acc of accounts) {
    let list: GymItem[] = [];
    if (Array.isArray(acc.gyms)) {
      list = acc.gyms;
    } else if (acc.gyms) {
      list = [acc.gyms];
    } else if (acc.id) {
      const { data: directGyms } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("account_id", acc.id);
      if (directGyms) {
        list = directGyms as GymItem[];
      }
    }
    list.forEach((g) => {
      staffMap.set(g.id, { gym_id: g.id, role: "owner", gyms: g });
    });
  }

  const staffItems = (rawStaffRes.data || []) as unknown as StaffEntry[];
  for (const item of staffItems) {
    if (!staffMap.has(item.gym_id)) {
      let gymData = item.gyms;
      if (!gymData) {
        const { data: directGym } = await supabase
          .from("gyms")
          .select("id, name")
          .eq("id", item.gym_id)
          .maybeSingle();
        gymData = directGym as GymItem | null;
      }
      staffMap.set(item.gym_id, {
        gym_id: item.gym_id,
        role: item.role,
        gyms: gymData,
      });
    }
  }

  const staffList = Array.from(staffMap.values());
  const memberList = memberProfilesRes.data || [];

  // Rule 1: Owner or staff of exactly 1 gym and not a member elsewhere -> straight to /app/[gymId]/dashboard
  if (staffList.length === 1 && memberList.length === 0) {
    return {
      path: `/app/${staffList[0].gym_id}/dashboard`,
      type: "staff",
    };
  }

  // Rule 2: Multiple staff workspaces or both staff and member -> /select-workspace
  if (staffList.length > 1 || (staffList.length > 0 && memberList.length > 0)) {
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
