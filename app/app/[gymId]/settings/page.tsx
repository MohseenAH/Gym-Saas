import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { evaluatePilotStatus } from "@/lib/auth/trial";
import { SettingsViewClient } from "@/components/settings/settings-view-client";

interface SettingsPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { gymId } = await params;

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "settings:manage",
  });

  const supabase = await createClient();

  // Parallel fetch: Gym details, Branches, Plans, and cached User
  const [gymRes, branchesRes, plansRes, user] = await Promise.all([
    supabase
      .from("gyms")
      .select("name, phone, account_id, accounts(subscription_tier, trial_ends_at)")
      .eq("id", gymId)
      .single(),
    supabase
      .from("branches")
      .select("id, name, address, city, phone, is_active")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: true }),
    supabase
      .from("membership_plans")
      .select("id, name, duration_days, price, is_active, branch_id, branches!inner(gym_id)")
      .eq("branches.gym_id", gymId)
      .order("created_at", { ascending: true }),
    getCachedUser(),
  ]);

  const gym = gymRes.data;
  const branches = branchesRes.data || [];
  const plans = plansRes.data || [];

  const accountData = gym?.accounts as { subscription_tier?: string; trial_ends_at?: string } | null;
  const pilotStatus = evaluatePilotStatus(
    accountData?.trial_ends_at,
    accountData?.subscription_tier
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SettingsViewClient
        gymId={gymId}
        gymName={gym?.name || "Gym Workspace"}
        gymPhone={gym?.phone}
        branches={(branches || []).map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          city: b.city,
          phone: b.phone,
          is_active: b.is_active,
        }))}
        plans={(plans || []).map((p) => ({
          id: p.id,
          name: p.name,
          duration_days: p.duration_days,
          price: Number(p.price),
          is_active: p.is_active,
        }))}
        account={{
          tier: accountData?.subscription_tier || "starter",
          trialEndsAt: accountData?.trial_ends_at,
          isPilot: pilotStatus.isPilot,
          daysRemaining: pilotStatus.daysRemaining,
        }}
        userEmail={user?.email || ""}
        userRole={authContext.role}
      />
    </div>
  );
}
