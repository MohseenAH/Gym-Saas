import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { RecordPaymentModal } from "@/components/payments/record-payment-modal";
import { PaymentsLedgerClient, PaymentLedgerItem } from "@/components/payments/payments-ledger-client";
import { CreditCard, TrendingUp, Wallet, Banknote, Receipt } from "lucide-react";

interface PaymentsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; memberId?: string }>;
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
      "id, member_id, amount, payment_method, payment_status, payment_date, notes, members(id, full_name, phone, email), branches(name)"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false });

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
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Payment & Revenue Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Total Revenue</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              ₹{upiTotal.toLocaleString("en-IN")}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">UPI Collections</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              ₹{cashTotal.toLocaleString("en-IN")}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Cash Collections</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{allPayments.length}</div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Receipts Issued</div>
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