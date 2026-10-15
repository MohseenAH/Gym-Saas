import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { BranchManagerClient, BranchItem } from "@/components/branches/branch-manager-client";

interface PageProps {
  params: Promise<{ gymId: string }>;
}

export default async function BranchesPage({ params }: PageProps) {
  const { gymId } = await params;
  const authContext = await getAuthorizedActionContext({ gymId });

  const supabase = await createClient();

  // 1. Fetch member counts per branch
  const { data: members } = await supabase
    .from("members")
    .select("branch_id");

  const branches = authContext.branches;

  const memberCountByBranch = new Map<string, number>();
  (members || []).forEach((m) => {
    if (m.branch_id) {
      memberCountByBranch.set(m.branch_id, (memberCountByBranch.get(m.branch_id) || 0) + 1);
    }
  });

  const branchList: BranchItem[] = (branches || []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    phone: b.phone,
    isActive: b.is_active,
    memberCount: memberCountByBranch.get(b.id) || 0,
  }));

  const canManageBranches = hasCapability(authContext.role, "branches:manage");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BranchManagerClient
        gymId={gymId}
        branches={branchList}
        canManageBranches={canManageBranches}
      />
    </div>
  );
}
