import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { RecordPaymentModal } from "@/components/payments/record-payment-modal";
import { PaymentsLedgerClient, PaymentLedgerItem } from "@/components/payments/payments-ledger-client";
import { CreditCard, TrendingUp, Wallet } from "lucide-react";

interface PaymentsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; memberId?: string }>;
}

export default async function PaymentsPage({ params, searchParams }: PaymentsPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "payments:record",
  });

  const cookieStore = await cookies();
  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const supabase = await createClient();

  // 1. Fetch gym, branches, and user permissions in parallel
  const [gymRes, branchesRes] = await Promise.all([
    supabase
      .from("gyms")
      .select("name")
      .eq("id", gymId)
      .single(),
    supabase
      .from("branches")
      .select("id, name")
      .eq("gym_id", gymId)
      .eq("is_active", true),
  ]);

  const gym = gymRes.data;
  const branches = branchesRes.data || [];

  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  // 2. Fetch active members & payments filtered by branch context
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
      "id, member_id, amount, payment_method, payment_status, payment_date, notes, members(id, full_name, phone, email), branches(name)"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const [membersRes, paymentsRes] = await Promise.all([
    membersQuery,
    paymentsQuery,
  ]);

  const members = membersRes.data || [];
  const allPayments = paymentsRes.data || [];

  // Business Correctness: Only count 'paid' and 'partial' payments as collected revenue
  const validPayments = allPayments.filter(
    (p) => p.payment_status === "paid" || p.payment_status === "partial"
  );
  const totalRevenue = Math.round(validPayments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

  // Method breakdown (collected revenue only)
  let upiTotal = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  validPayments.forEach((p) => {
    const amt = Number(p.amount);
    if (p.payment_method === "upi") upiTotal += amt;
    else if (p.payment_method === "cash") cashTotal += amt;
    else cardTotal += amt;
  });
  upiTotal = Math.round(upiTotal * 100) / 100;
  cashTotal = Math.round(cashTotal * 100) / 100;
  cardTotal = Math.round(cardTotal * 100) / 100;

  const formattedLedger: PaymentLedgerItem[] = allPayments.map((p) => {
    const member = p.members as unknown as { full_name?: string; phone?: string; email?: string } | null;
    const branch = p.branches as unknown as { name?: string } | null;
    return {
      id: p.id,
      memberId: p.member_id,
      memberName: member?.full_name || "Unknown Member",
      memberPhone: member?.phone || "",
      memberEmail: member?.email || null,
      branchName: branch?.name || "Main Branch",
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      paymentStatus: p.payment_status,
      paymentDate: p.payment_date,
      notes: p.notes,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment & Revenue Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track member fee collections, payment methods, and automated WhatsApp & printable receipts
          </p>
        </div>
        <RecordPaymentModal
          gymId={gymId}
          branches={branches || []}
          members={(members || []).map((m) => ({
            id: m.id,
            fullName: m.full_name,
            phone: m.phone,
            branchId: m.branch_id,
          }))}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 font-medium">Total Revenue Collected</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              UPI: ₹{upiTotal.toLocaleString("en-IN")} • Cash: ₹{cashTotal.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Card & Others: ₹{cardTotal.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allPayments.length}</div>
            <div className="text-xs text-slate-500 font-medium">Payment Receipts Issued</div>
          </div>
        </div>
      </div>

      {/* Interactive Payment Ledger with ReceiptModal */}
      <PaymentsLedgerClient
        gymId={gymId}
        gymName={gym?.name || "Our Gym"}
        payments={formattedLedger}
      />
    </div>
  );
}
