"use client";

import { useState } from "react";
import { Plus, X, Receipt, Loader2 } from "lucide-react";
import { createExpenseAction, type CreateExpenseInput } from "@/lib/actions/expenses";
import { getTodayIST } from "@/lib/utils";

interface RecordExpenseModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
}

export function RecordExpenseModal({ gymId, branches }: RecordExpenseModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [category, setCategory] = useState<string>("rent");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(getTodayIST());
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [description, setDescription] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid expense amount");
      return;
    }

    setLoading(true);
    const res = await createExpenseAction({
      gymId,
      branchId,
      category: category as CreateExpenseInput["category"],
      amount: numAmount,
      expenseDate,
      paymentMethod: paymentMethod as CreateExpenseInput["paymentMethod"],
      description: description || null,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to record expense");
    } else {
      setIsOpen(false);
      setAmount("");
      setDescription("");
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-10 sm:h-11 flex items-center justify-center gap-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
      >
        <Plus className="w-4 h-4" />
        Record Expense
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">Record Gym Expense</h3>
                  <p className="text-xs text-muted-foreground">Track operational outflow and overhead</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Branch Location
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-12 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 capitalize transition-all font-medium"
                  >
                    <option value="rent">Rent</option>
                    <option value="electricity">Electricity / Water</option>
                    <option value="salaries">Salaries & Commissions</option>
                    <option value="equipment">Equipment Purchase / EMI</option>
                    <option value="maintenance">Repairs & Maintenance</option>
                    <option value="marketing">Marketing & Ads</option>
                    <option value="miscellaneous">Miscellaneous</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-12 px-3.5 bg-background border border-border rounded-xl text-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-black tracking-tight transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 capitalize transition-all font-medium"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="card">Debit / Credit Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Description / Payee Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid trainer monthly stipend, purchased 2x 20kg plates"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-11 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Expense Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}