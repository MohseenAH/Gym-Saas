import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { RecordExpenseModal } from "@/components/expenses/record-expense-modal";
import { Receipt, TrendingDown, Layers, Trash2 } from "lucide-react";
import { deleteExpenseAction } from "@/lib/actions/expenses";

interface ExpensesPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function ExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "expenses:manage",
  });

  const cookieStore = await cookies();
  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const supabase = await createClient();

  // Fetch branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true);

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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Expense Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track operational expenses, utility bills, maintenance, and staff payroll
          </p>
        </div>
        <RecordExpenseModal gymId={gymId} branches={branches || []} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              ₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 font-medium">Total Expenses Recorded</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 capitalize">
              {topCategory ? topCategory[0] : "None"}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Top Expense Category {topCategory ? `(₹${topCategory[1].toLocaleString()})` : ""}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allExpenses.length}</div>
            <div className="text-xs text-slate-500 font-medium">Expense Invoices / Vouchers</div>
          </div>
        </div>
      </div>

      {/* Category Distribution Pills */}
      {Object.keys(categoryMap).length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-700 mb-2">Category Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryMap).map(([cat, val]) => (
              <div
                key={cat}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/60 text-xs"
              >
                <span className="font-semibold text-slate-800 capitalize">{cat}:</span>
                <span className="font-bold text-red-600">₹{val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">Expense Ledger</div>
          <div className="text-xs text-slate-400">{allExpenses.length} records</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
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
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {allExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No expenses recorded yet. Click &quot;Record Expense&quot; above to log your first operational cost.
                  </td>
                </tr>
              ) : (
                allExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 font-semibold text-slate-900 whitespace-nowrap">
                      {expense.expense_date}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200/60 rounded-lg font-bold capitalize">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {(expense.branches as unknown as { name?: string } | null)?.name || "Main Branch"}
                    </td>
                    <td className="p-3.5 uppercase font-medium text-slate-500">
                      {expense.payment_method}
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-slate-500">
                      {expense.description || "—"}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 whitespace-nowrap">
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
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
