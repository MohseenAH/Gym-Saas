import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { PaymentsLedgerClient, PaymentLedgerItem } from "@/components/payments/payments-ledger-client";

interface PaymentsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; memberId?: string }>;
}

function extractUtrFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/utr[:\s#-]+([A-Za-z0-9_-]+)/i);
  return match && match[1] ? match[1].trim() : null;
}

function extractProofUrlFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/https?:\/\/[^\s"',)]+/i);
  if (match) {
    const url = match[0];
    if (url.match(/\.(jpeg|jpg|png|webp|gif)/i) || url.includes("/storage/")) {
      return url;
    }
  }
  return null;
}

export default async function PaymentsPage({ params, searchParams }: PaymentsPageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string; memberId?: string }),
    cookies(),
    params.then(({ gymId: id }) => getAuthorizedActionContext({ gymId: id, capability: "payments:record" })),
  ]);

  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const supabase = await createClient();

  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  // Prepare active members & payments queries filtered by branch context
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, branch_id")
    .eq("status", "active")
    .order("full_name");

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, member_id, membership_id, amount, payment_method, payment_status, payment_date, notes, created_at, members(id, full_name, phone, email, branch_id), branches(name), memberships(id, membership_plans(name, price))"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (branchContext.selectedBranchId) {
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Execute all payments queries concurrently in parallel
  const [membersRes, paymentsRes] = await Promise.all([
    membersQuery,
    paymentsQuery,
  ]);

  const gym = authContext.gym;
  const branches = authContext.branches;

  const members = membersRes.data || [];
  const allPayments = paymentsRes.data || [];

  const formattedLedger: PaymentLedgerItem[] = allPayments.map((p) => {
    const member = p.members as unknown as { full_name?: string; phone?: string; email?: string } | null;
    const branch = p.branches as unknown as { name?: string } | null;
    const membership = p.memberships as unknown as { membership_plans?: { name?: string; price?: number } | null } | null;
    const utr = extractUtrFromNotes(p.notes);
    const proofUrl = extractProofUrlFromNotes(p.notes);
    const planName = membership?.membership_plans?.name || (p.notes && !p.notes.startsWith("Member UPI") ? p.notes : "Membership Fee");

    return {
      id: p.id,
      memberId: p.member_id,
      memberName: member?.full_name || "Unknown Member",
      memberPhone: member?.phone || "",
      memberEmail: member?.email || null,
      branchName: branch?.name || "Main Branch",
      planName,
      membershipId: p.membership_id,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      paymentStatus: p.payment_status,
      paymentDate: p.payment_date,
      createdAt: p.created_at,
      notes: p.notes,
      utr,
      proofUrl,
    };
  });

  const modalMembers = members.map((m) => ({
    id: m.id,
    fullName: m.full_name,
    phone: m.phone,
    branchId: m.branch_id,
  }));

  const modalBranches = (branches || []).map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PaymentsLedgerClient
        gymId={gymId}
        gymName={gym?.name || "Our Gym"}
        payments={formattedLedger}
        members={modalMembers}
        branches={modalBranches}
      />
    </div>
  );
}
