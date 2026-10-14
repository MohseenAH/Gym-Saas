import { createClient } from "@/lib/supabase/server";
import { Calendar } from "lucide-react";
import { PayDuesModal } from "@/components/portal/pay-dues-modal";
import { PortalPaymentsClient } from "@/components/portal/portal-payments-client";

interface BranchRelation {
  name: string;
  gyms: { name: string } | null;
}

interface PlanRelation {
  name: string;
  price: number;
}

interface PaymentsPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function MemberPaymentsPage({ params }: PaymentsPageProps) {
  await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, branches(name, gyms(name))")
    .eq("user_id", user?.id)
    .single();

  if (!member) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Member record not found.
      </div>
    );
  }

  const branchData = member.branches as unknown as BranchRelation | null;
  const gymName = branchData?.gyms?.name || "Gym";
  const branchName = branchData?.name || "Main Branch";

  // Parallel fetch: active membership and payment receipts
  const [membershipRes, paymentsRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, end_date, status, membership_plans(name, price)")
      .eq("member_id", member.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, amount, payment_method, payment_status, payment_date, notes")
      .eq("member_id", member.id)
      .order("payment_date", { ascending: false }),
  ]);

  const membership = membershipRes.data;
  const allPayments = paymentsRes.data || [];
  const planData = membership?.membership_plans as unknown as PlanRelation | null;
  const planName = planData?.name;
  const planPrice = Number(planData?.price || 0);

  const formattedPayments = allPayments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    paymentDate: p.payment_date,
    notes: p.notes,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payments & Invoices</h1>
          <p className="text-xs text-slate-500 mt-1">
            View past membership receipts, print invoices, and pay upcoming dues
          </p>
        </div>
        <PayDuesModal
          gymName={gymName}
          planName={planName}
          amount={planPrice > 0 ? planPrice : 1500}
        />
      </div>

      {/* Current Membership Plan Card */}
      {membership && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{planName}</div>
              <div className="text-xs text-slate-500">
                Active until {membership.end_date}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
              Active Plan
            </span>
          </div>
        </div>
      )}

      {/* Past Receipts Feed with ReceiptModal */}
      <PortalPaymentsClient
        gymName={gymName}
        branchName={branchName}
        memberName={member.full_name}
        memberPhone={member.phone}
        planName={planName}
        payments={formattedPayments}
      />
    </div>
  );
}
