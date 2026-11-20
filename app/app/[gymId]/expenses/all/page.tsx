import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedGymAuthContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { ExpenseLedgerClient } from "@/components/expenses/expense-ledger-client";
import { type ExpenseItem } from "@/components/expenses/expense-modals";

interface AllExpensesPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; category?: string }>;
}

export default async function AllExpensesPage({ params, searchParams }: AllExpensesPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Financial route lockdown: Floor staff cannot access expense ledgers
  const authContext = await getCachedGymAuthContext(gymId);
  if (!hasCapability(authContext.role, "expenses:manage")) {
    redirect(`/app/${gymId}/attendance`);
  }

  const cookieStore = await cookies();
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

  // Fetch all expenses for this gym workspace filtered by branch context
  let expensesQuery = supabase
    .from("expenses")
    .select("id, branch_id, category, amount, expense_date, payment_method, description, created_at, branches(name)")
    .eq("gym_id", gymId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (branchContext.selectedBranchId) {
    expensesQuery = expensesQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    expensesQuery = expensesQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const { data: expenses } = await expensesQuery;

  const branches = authContext.branches || [];
  const rawExpenses = expenses || [];

  const formattedExpenses: ExpenseItem[] = rawExpenses.map((e) => {
    const branchInfo = e.branches as unknown as { name?: string } | null;
    return {
      id: e.id,
      branch_id: e.branch_id,
      category: e.category as ExpenseItem["category"],
      amount: Number(e.amount),
      expense_date: e.expense_date,
      payment_method: e.payment_method as ExpenseItem["payment_method"],
      description: e.description,
      created_at: e.created_at,
      branch_name: branchInfo?.name || "Main Branch",
      branches: branchInfo,
    };
  });

  const canManage = hasCapability(authContext.role, "expenses:manage");
  const canDelete = ["owner", "partner", "manager"].includes(authContext.role);

  return (
    <div className="max-w-7xl mx-auto">
      <ExpenseLedgerClient
        gymId={gymId}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        initialExpenses={formattedExpenses}
        canManage={canManage}
        canDelete={canDelete}
        initialCategory={resolvedSearchParams.category}
      />
    </div>
  );
}
