"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Receipt,
  Loader2,
  Trash2,
  Edit2,
  Eye,
  Plus,
  AlertTriangle,
  Calendar,
  Building2,
  CreditCard,
  Tag,
  FileText,
} from "lucide-react";
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "@/lib/actions/expenses";
import { getTodayIST } from "@/lib/utils";

export interface ExpenseItem {
  id: string;
  branch_id: string;
  category:
    | "rent"
    | "electricity"
    | "salaries"
    | "equipment"
    | "maintenance"
    | "marketing"
    | "miscellaneous"
    | "other";
  amount: number;
  expense_date: string;
  payment_method: "cash" | "bank_transfer" | "upi" | "card" | "cheque" | "other";
  description: string | null;
  receipt_url?: string | null;
  created_at?: string;
  branches?: { name?: string } | null;
  branch_name?: string;
}

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "electricity", label: "Electricity / Utilities" },
  { value: "salaries", label: "Salaries & Payroll" },
  { value: "equipment", label: "Equipment / Purchase" },
  { value: "maintenance", label: "Repairs & Maintenance" },
  { value: "marketing", label: "Marketing & Ads" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "other", label: "Other" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

export function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case "rent":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "electricity":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "salaries":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "equipment":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
    case "maintenance":
      return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30";
    case "marketing":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    case "miscellaneous":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function formatVoucherId(id: string): string {
  return `#EXP-${id.slice(0, 6).toUpperCase()}`;
}

// ==========================================
// 1. RECORD EXPENSE MODAL
// ==========================================
interface RecordExpenseModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
  isOpen?: boolean;
  onClose?: () => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RecordExpenseModal({
  gymId,
  branches,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  trigger,
  onSuccess,
}: RecordExpenseModalProps) {
  const router = useRouter();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  function closeModal() {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }

  function openModal() {
    setInternalIsOpen(true);
  }

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
      setError("Please enter a valid expense amount greater than 0");
      return;
    }

    setLoading(true);

    try {
      const res = await createExpenseAction({
        gymId,
        branchId: branchId || branches[0]?.id || "",
        category: category as CreateExpenseInput["category"],
        amount: numAmount,
        expenseDate,
        paymentMethod: paymentMethod as CreateExpenseInput["paymentMethod"],
        description: description || null,
      });

      if (!res.success) {
        setError(res.error || "Failed to record expense");
        setLoading(false);
        return;
      }

      setLoading(false);
      closeModal();
      setAmount("");
      setDescription("");
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record expense");
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <div onClick={openModal}>{trigger}</div>
      ) : controlledIsOpen === undefined ? (
        <button
          type="button"
          onClick={openModal}
          className="h-10 sm:h-11 flex items-center justify-center gap-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      ) : null}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">Record Gym Expense</h3>
                  <p className="text-xs text-muted-foreground">Track operational outflow and overhead</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium">
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer capitalize"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-black tracking-tight transition-all"
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Description / Payee Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid monthly gym rent, purchased barbell plates, maintenance vendor"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
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

// ==========================================
// 2. VIEW EXPENSE DETAILS MODAL
// ==========================================
interface ViewExpenseModalProps {
  expense: ExpenseItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (expense: ExpenseItem) => void;
}

export function ViewExpenseModal({ expense, isOpen, onClose, onEdit }: ViewExpenseModalProps) {
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-150 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-card-foreground">Expense Voucher Details</h3>
              <p className="text-xs font-mono text-muted-foreground">{formatVoucherId(expense.id)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Amount Card */}
        <div className="bg-muted/40 p-4 rounded-2xl border border-border flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              Voucher Total
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground mt-0.5">
              ₹{Number(expense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${getCategoryBadgeClass(
              expense.category
            )}`}
          >
            {expense.category}
          </span>
        </div>

        {/* Details Grid */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-border/60">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date
            </span>
            <span className="font-bold text-foreground">{expense.expense_date}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-border/60">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Payment Method
            </span>
            <span className="font-bold text-foreground uppercase">{expense.payment_method}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-border/60">
            <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Branch
            </span>
            <span className="font-bold text-foreground">
              {expense.branch_name || expense.branches?.name || "Main Branch"}
            </span>
          </div>

          <div className="py-2">
            <span className="text-muted-foreground font-semibold block mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Description / Notes
            </span>
            <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-foreground font-medium text-xs leading-relaxed">
              {expense.description || "No description provided."}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(expense);
              }}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Voucher</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. EDIT EXPENSE MODAL
// ==========================================
interface EditExpenseModalProps {
  gymId: string;
  expense: ExpenseItem | null;
  branches: { id: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditExpenseModal({
  gymId,
  expense,
  branches,
  isOpen,
  onClose,
  onSuccess,
}: EditExpenseModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState(expense?.branch_id || branches[0]?.id || "");
  const [category, setCategory] = useState<string>(expense?.category || "rent");
  const [amount, setAmount] = useState<string>(expense?.amount ? String(expense.amount) : "");
  const [expenseDate, setExpenseDate] = useState<string>(expense?.expense_date || getTodayIST());
  const [paymentMethod, setPaymentMethod] = useState<string>(expense?.payment_method || "cash");
  const [description, setDescription] = useState<string>(expense?.description || "");

  // Update fields when target expense changes
  if (expense && amount === "" && expense.amount) {
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setBranchId(expense.branch_id);
    setExpenseDate(expense.expense_date);
    setPaymentMethod(expense.payment_method);
    setDescription(expense.description || "");
  }

  if (!isOpen || !expense) return null;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!expense) return;

    setError(null);
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid expense amount greater than 0");
      return;
    }

    setLoading(true);

    try {
      const res = await updateExpenseAction({
        gymId,
        expenseId: expense.id,
        branchId: branchId || expense.branch_id,
        category: category as UpdateExpenseInput["category"],
        amount: numAmount,
        expenseDate,
        paymentMethod: paymentMethod as UpdateExpenseInput["paymentMethod"],
        description: description || null,
      });

      if (!res.success) {
        setError(res.error || "Failed to update expense");
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update expense");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-card-foreground">Edit Expense Record</h3>
              <p className="text-xs font-mono text-muted-foreground">{formatVoucherId(expense.id)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="mt-5 space-y-4">
          {branches.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Branch Location
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
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
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer capitalize"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
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
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-black tracking-tight transition-all"
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
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
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
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Description / Payee Note (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. DELETE EXPENSE CONFIRMATION MODAL
// ==========================================
interface DeleteExpenseModalProps {
  gymId: string;
  expense: ExpenseItem | null;
  isOpen: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteExpenseModal({
  gymId,
  expense,
  isOpen,
  canDelete,
  onClose,
  onSuccess,
}: DeleteExpenseModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  async function handleDelete() {
    if (!expense) return;

    setLoading(true);
    setError(null);

    try {
      const res = await deleteExpenseAction({
        gymId,
        expenseId: expense.id,
        branchId: expense.branch_id,
      });

      if (!res.success) {
        setError(res.error || "Failed to delete expense record");
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete expense");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card text-card-foreground rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-150 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Delete Expense Voucher</h3>
            <p className="text-xs font-mono text-muted-foreground">{formatVoucherId(expense.id)}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <div className="bg-muted/40 p-3.5 rounded-2xl border border-border text-xs space-y-1">
          <div className="flex items-center justify-between font-bold text-foreground text-sm">
            <span className="capitalize">{expense.category}</span>
            <span className="text-rose-600">₹{Number(expense.amount).toFixed(2)}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2">
            <span>{expense.expense_date}</span>
            <span>•</span>
            <span className="uppercase">{expense.payment_method}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {canDelete
            ? "Are you sure you want to permanently delete this expense voucher? This will remove the transaction from the financial ledger and update all expense reports."
            : "Only Gym Owners, Partners, and Managers have permission to delete recorded expense vouchers."}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Confirm Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
