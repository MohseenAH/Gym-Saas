import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedGymAuthContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { RecordExpenseModal } from "@/components/expenses/record-expense-modal";
import { Receipt, TrendingDown, Layers, Trash2, Tag } from "lucide-react";
import { deleteExpenseAction } from "@/lib/actions/expenses";

interface ExpensesPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function ExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Financial route lockdown: Floor staff (trainers/staff) cannot access expense ledgers
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

  // Fetch expenses filtered by branch context
  let expensesQuery = supabase
    .from("expenses")
    .select("id, branch_id, category, amount, expense_date, payment_method, description, branches(name)")
    .eq("gym_id", gymId)
    .order("expense_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    expensesQuery = expensesQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    expensesQuery = expensesQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const { data: expenses } = await expensesQuery;

  const branches = authContext.branches;
  const allExpenses = expenses || [];

  // Aggregations
  const totalExpense = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  allExpenses.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });

  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Expense Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track operational expenses, utility bills, maintenance, and staff payroll
          </p>
        </div>
        <RecordExpenseModal gymId={gymId} branches={branches || []} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-rose-500/10 text-rose-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              ₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Total Expenses</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate capitalize">
              {topCategory ? topCategory[0] : "None"}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Top Category {topCategory ? `(₹${topCategory[1].toLocaleString()})` : ""}
            </div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{allExpenses.length}</div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Expense Vouchers</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 rounded-xl sm:rounded-2xl shadow-2xs">
            <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {Object.keys(categoryMap).length}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Categories</div>
          </div>
        </div>
      </div>

      {/* Category Distribution Pills */}
      {Object.keys(categoryMap).length > 0 && (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs">
          <div className="text-sm font-bold text-foreground mb-2">Category Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryMap).map(([cat, val]) => (
              <div
                key={cat}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-xl border border-border text-sm"
              >
                <span className="font-semibold text-foreground capitalize">{cat}:</span>
                <span className="font-bold text-rose-500">₹{val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Ledger Table */}
      <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-base font-bold text-card-foreground">Expense Ledger</div>
          <div className="text-sm text-muted-foreground font-medium">{allExpenses.length} records</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-xs border-b border-border">
              <tr>
                <th className="p-3.5 pl-4">Date</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Branch</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5">Notes</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {allExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground font-medium">
                    No expenses recorded yet. Click &quot;Record Expense&quot; above to log your first operational cost.
                  </td>
                </tr>
              ) : (
                allExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 pl-4 font-semibold text-foreground whitespace-nowrap">
                      {expense.expense_date}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full font-bold text-xs capitalize tracking-wide">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                      {(expense.branches as unknown as { name?: string } | null)?.name || "Main Branch"}
                    </td>
                    <td className="p-3.5 uppercase font-medium text-muted-foreground">
                      {expense.payment_method}
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-muted-foreground">
                      {expense.description || "—"}
                    </td>
                    <td className="p-3.5 text-right font-black text-foreground whitespace-nowrap text-base">
                      ₹{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 pr-4 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deleteExpenseAction({
                            gymId,
                            expenseId: expense.id,
                            branchId: expense.branch_id,
                          });
                        }}
                      >
                        <button
                          type="submit"
                          className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}