import { createClient } from "@/lib/supabase/server";

export interface PersonaDestination {
  path: string;
  type: "staff" | "member" | "selector" | "onboarding";
}

export async function resolvePostLoginRedirect(): Promise<PersonaDestination> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { path: "/login", type: "onboarding" };
  }

  // 1. Check directly owned gyms via accounts table
  const { data: ownedAccounts } = await supabase
    .from("accounts")
    .select("id, gyms ( id, name )")
    .eq("owner_id", user.id);

  // 2. Check active staff relationships
  const { data: rawStaffMemberships } = await supabase
    .from("gym_users")
    .select("gym_id, role, gyms ( id, name )")
    .eq("user_id", user.id)
    .eq("status", "active");

  interface StaffEntry {
    gym_id: string;
    role: string;
    gyms?: { id: string; name: string } | null;
  }
  interface AccountWithGyms {
    id: string;
    gyms?: { id: string; name: string }[] | null;
  }

  const staffMap = new Map<string, StaffEntry>();
  ((ownedAccounts as unknown as AccountWithGyms[]) || []).forEach((acc) => {
    (acc.gyms || []).forEach((g) => {
      staffMap.set(g.id, { gym_id: g.id, role: "owner", gyms: g });
    });
  });

  ((rawStaffMemberships as unknown as StaffEntry[]) || []).forEach((item) => {
    if (!staffMap.has(item.gym_id)) {
      staffMap.set(item.gym_id, item);
    }
  });

  const staffList = Array.from(staffMap.values());

  // 3. Check active member portal relationships
  const { data: memberProfiles } = await supabase
    .from("members")
    .select("id, branch_id, branches ( id, gym_id, gyms ( id, name ) )")
    .eq("user_id", user.id)
    .eq("status", "active");

  const memberList = memberProfiles || [];

  // Multi-persona or multi-gym: go to workspace selector
  if (
    (staffList.length > 0 && memberList.length > 0) ||
    staffList.length > 1 ||
    memberList.length > 1
  ) {
    return { path: "/select-workspace", type: "selector" };
  }

  // Single staff relationship
  if (staffList.length === 1 && memberList.length === 0) {
    return {
      path: `/app/${staffList[0].gym_id}/dashboard`,
      type: "staff",
    };
  }

  // Single member portal relationship
  if (memberList.length === 1 && staffList.length === 0) {
    const branches = memberList[0].branches as unknown as { gym_id?: string } | null;
    const gymId = branches?.gym_id;
    if (gymId) {
      return {
        path: `/portal/${gymId}/dashboard`,
        type: "member",
      };
    }
  }

  // No active relationships yet
  return { path: "/onboarding", type: "onboarding" };
}
