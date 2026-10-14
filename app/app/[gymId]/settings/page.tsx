import { createClient } from "@/lib/supabase/server";
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

  // 1. Fetch Gym & Account
  const { data: gym } = await supabase
    .from("gyms")
    .select("name, phone, account_id, accounts(subscription_tier, trial_ends_at)")
    .eq("id", gymId)
    .single();

  const accountData = gym?.accounts as { subscription_tier?: string; trial_ends_at?: string } | null;
  const pilotStatus = evaluatePilotStatus(
    accountData?.trial_ends_at,
    accountData?.subscription_tier
  );

  // 2. Fetch Branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, city, phone, is_active")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: true });

  // 3. Fetch Membership Plans
  const branchIds = (branches || []).map((b) => b.id);
  const { data: plans } =
    branchIds.length > 0
      ? await supabase
          .from("membership_plans")
          .select("id, name, duration_days, price, is_active, branch_id")
          .in("branch_id", branchIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  // 4. Fetch User Profile
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
