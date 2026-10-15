import { cache } from "react";
import { createClient, getCachedUser, CachedUser } from "@/lib/supabase/server";
import { StaffRole } from "./roles";
import { Capability, hasCapability } from "./capabilities";
import { evaluatePilotStatus } from "./trial";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface GymRecord {
  id: string;
  name: string;
  phone?: string | null;
  account_id?: string;
  accounts?: {
    id?: string;
    owner_id?: string;
    status?: string;
    subscription_tier?: string;
    trial_ends_at?: string;
    grace_period_ends_at?: string;
  } | null;
}

export interface BranchRecord {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  is_active: boolean;
  is_main?: boolean;
}

export interface ProfileRecord {
  id: string;
  full_name?: string | null;
  phone?: string | null;
}

export interface GymUserRecord {
  id: string;
  role: string;
  status: string;
  user_branch_access?: Array<{ branch_id: string }>;
}

export interface AuthorizedContext {
  userId: string;
  gymId: string;
  role: StaffRole;
  gymUserId: string;
  branchIds: string[];
  user: CachedUser;
  gym: GymRecord;
  gymUser?: GymUserRecord | null;
  branches: BranchRecord[];
  accessibleBranches: BranchRecord[];
  profile?: ProfileRecord | null;
  trialStatus: {
    isPilot: boolean;
    isActive: boolean;
    daysRemaining: number;
    badgeText: string;
  };
}

/**
 * Request-level cached resolution of user, gym role, and authorized branches.
 * Collapses gym, gym_user, branches, and profile lookups into ONE Promise.all batch.
 * Using React's cache() ensures Supabase is queried only once per page load.
 */
export const getCachedGymAuthContext = cache(
  async (gymId: string): Promise<AuthorizedContext> => {
    const user = await getCachedUser();

    if (!user) {
      throw new AuthorizationError("Authentication required");
    }

    const supabase = await createClient();

    // Parallel fetch: gyms, gym_users, branches, profiles, and owned accounts
    const [gymRes, gymUserRes, branchesRes, profileRes, ownerAccountRes] =
      await Promise.all([
        // 1. The gyms record (safe columns only, no joins with non-existent columns)
        supabase
          .from("gyms")
          .select("id, name, phone, account_id")
          .eq("id", gymId)
          .maybeSingle(),

        // 2. The user's gym_users row (with nested user_branch_access(branch_id))
        supabase
          .from("gym_users")
          .select("id, role, status, user_branch_access(branch_id)")
          .eq("gym_id", gymId)
          .eq("user_id", user.id)
          .maybeSingle(),

        // 3. All branches for gymId (safe columns only)
        supabase
          .from("branches")
          .select("id, name, address, city, is_active")
          .eq("gym_id", gymId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),

        // 4. The user's profiles row
        supabase
          .from("profiles")
          .select("id, full_name, phone")
          .eq("id", user.id)
          .maybeSingle(),

        // 5. Account owned by current user (if any)
        supabase
          .from("accounts")
          .select(
            "id, owner_id, subscription_tier, trial_ends_at, gyms(id, name, phone, account_id)"
          )
          .eq("owner_id", user.id)
          .maybeSingle(),
      ]);

    // Handle gym resolution safely
    let gymData = gymRes.data as {
      id: string;
      name: string;
      phone?: string | null;
      account_id?: string;
    } | null;

    const ownedAccount = ownerAccountRes.data;

    // Fallback: If direct gym query returned null (e.g. RLS join gap), check if user owns the account associated with this gym
    if (!gymData && ownedAccount) {
      const accountGyms = Array.isArray(ownedAccount.gyms)
        ? ownedAccount.gyms
        : ownedAccount.gyms
        ? [ownedAccount.gyms]
        : [];
      const matched = accountGyms.find((g: { id: string }) => g.id === gymId);
      if (matched) {
        gymData = {
          id: matched.id,
          name: matched.name,
          phone: matched.phone,
          account_id: ownedAccount.id,
        };
      }
    }

    if (!gymData) {
      throw new AuthorizationError("Gym workspace not found");
    }

    // Resolve account details for trial status evaluation
    let account: GymRecord["accounts"] = null;
    if (
      ownedAccount &&
      (ownedAccount.id === gymData.account_id || ownedAccount.owner_id === user.id)
    ) {
      account = {
        id: ownedAccount.id,
        owner_id: ownedAccount.owner_id,
        subscription_tier: ownedAccount.subscription_tier,
        trial_ends_at: ownedAccount.trial_ends_at,
      };
    } else if (gymData.account_id) {
      const { data: directAccount } = await supabase
        .from("accounts")
        .select("id, owner_id, subscription_tier, trial_ends_at")
        .eq("id", gymData.account_id)
        .maybeSingle();
      if (directAccount) {
        account = directAccount;
      }
    }

    const isAccountOwner =
      account?.owner_id === user.id ||
      (ownedAccount && ownedAccount.id === gymData.account_id);

    const gymUser = (gymUserRes.data as unknown as GymUserRecord) || null;
    let role: StaffRole = "staff";
    let gymUserId = "";

    if (isAccountOwner) {
      role = "owner";
      gymUserId = gymUser?.id || user.id;
    } else if (gymUser) {
      if (gymUser.status !== "active") {
        throw new AuthorizationError("Account is suspended");
      }
      role = gymUser.role as StaffRole;
      gymUserId = gymUser.id;
    } else {
      throw new AuthorizationError("No staff access to this gym workspace");
    }

    // Branch resolution: auto-create Main Branch if 0 branches exist
    let branches = (branchesRes.data || []) as BranchRecord[];

    if (branches.length === 0) {
      try {
        const { data: createdBranch } = await supabase
          .from("branches")
          .insert({
            gym_id: gymId,
            name: "Main Branch",
            is_active: true,
          })
          .select("id, name, address, city, is_active")
          .maybeSingle();

        if (createdBranch) {
          branches = [createdBranch as BranchRecord];
        }
      } catch {
        // Silently catch and fallback to in-memory branch context
      }

      if (branches.length === 0) {
        branches = [
          {
            id: `default-${gymId}`,
            name: "Main Branch",
            is_active: true,
          },
        ];
      }
    }

    let accessibleBranches: BranchRecord[] = [];
    let branchIds: string[] = [];

    if (role === "owner" || role === "partner") {
      branchIds = branches.map((b) => b.id);
      accessibleBranches = branches;
    } else {
      const allowedIds = (gymUser?.user_branch_access || []).map((uba) => uba.branch_id);
      if (allowedIds.length > 0) {
        branchIds = allowedIds;
        accessibleBranches = branches.filter((b) => allowedIds.includes(b.id));
      }
      // If staff has no explicit branch access rows, grant access to all active branches
      if (accessibleBranches.length === 0) {
        branchIds = branches.map((b) => b.id);
        accessibleBranches = branches;
      }
    }

    const trialStatus = evaluatePilotStatus(
      account?.trial_ends_at,
      account?.subscription_tier || "pro"
    );

    const profile = (profileRes.data as unknown as ProfileRecord) || null;

    const gym: GymRecord = {
      id: gymData.id,
      name: gymData.name,
      phone: gymData.phone,
      account_id: gymData.account_id,
      accounts: account,
    };

    return {
      userId: user.id,
      gymId,
      role,
      gymUserId,
      branchIds,
      user,
      gym,
      gymUser,
      branches,
      accessibleBranches,
      profile,
      trialStatus,
    };
  }
);

export async function getAuthorizedActionContext(params: {
  gymId: string;
  capability?: Capability;
  targetBranchId?: string;
}): Promise<AuthorizedContext> {
  const context = await getCachedGymAuthContext(params.gymId);

  // Verify capability
  if (params.capability && !hasCapability(context.role, params.capability)) {
    throw new AuthorizationError(
      `Permission denied: Missing required capability '${params.capability}'`
    );
  }

  // Verify target branch access if requested
  if (params.targetBranchId && !context.branchIds.includes(params.targetBranchId)) {
    throw new AuthorizationError("Permission denied: No access to this branch");
  }

  return context;
}
