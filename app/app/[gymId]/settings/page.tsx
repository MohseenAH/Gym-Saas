import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
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

  // Fetch plans (gym, branches, user, and trialStatus are already cached on authContext)
  const { data: plansData } = await supabase
    .from("membership_plans")
    .select("id, name, duration_days, price, is_active, branch_id, branches!inner(gym_id)")
    .eq("branches.gym_id", gymId)
    .order("created_at", { ascending: true });

  const gym = authContext.gym;
  const branches = authContext.branches;
  const plans = plansData || [];
  const pilotStatus = authContext.trialStatus;
  const user = authContext.user;
  const accountData = gym?.accounts;

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
