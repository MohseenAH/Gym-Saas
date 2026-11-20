"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

const createExpenseSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  category: z.enum([
    "rent",
    "electricity",
    "salaries",
    "equipment",
    "maintenance",
    "marketing",
    "miscellaneous",
    "other",
  ]),
  amount: z.number().positive("Amount must be greater than 0"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  paymentMethod: z.enum(["cash", "bank_transfer", "upi", "card", "cheque", "other"]).default("cash"),
  description: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

const updateExpenseSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  expenseId: z.string().uuid("Invalid expense ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  category: z.enum([
    "rent",
    "electricity",
    "salaries",
    "equipment",
    "maintenance",
    "marketing",
    "miscellaneous",
    "other",
  ]),
  amount: z.number().positive("Amount must be greater than 0"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  paymentMethod: z.enum(["cash", "bank_transfer", "upi", "card", "cheque", "other"]).default("cash"),
  description: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export async function createExpenseAction(input: CreateExpenseInput) {
  try {
    const validated = createExpenseSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "expenses:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        gym_id: context.gymId,
        branch_id: validated.branchId,
        category: validated.category,
        amount: validated.amount,
        expense_date: validated.expenseDate,
        payment_method: validated.paymentMethod,
        description: validated.description || null,
        receipt_url: validated.receiptUrl || null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: `Failed to record expense: ${error.message}` };
    }

    revalidatePath(`/app/${validated.gymId}/expenses`);
    revalidatePath(`/app/${validated.gymId}/expenses/all`);

    return JSON.parse(JSON.stringify({ success: true, expenseId: expense.id }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

export async function updateExpenseAction(input: UpdateExpenseInput) {
  try {
    const validated = updateExpenseSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "expenses:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("expenses")
      .update({
        branch_id: validated.branchId,
        category: validated.category,
        amount: validated.amount,
        expense_date: validated.expenseDate,
        payment_method: validated.paymentMethod,
        description: validated.description || null,
        receipt_url: validated.receiptUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.expenseId)
      .eq("gym_id", context.gymId);

    if (error) {
      return { success: false, error: `Failed to update expense: ${error.message}` };
    }

    revalidatePath(`/app/${validated.gymId}/expenses`);
    revalidatePath(`/app/${validated.gymId}/expenses/all`);

    return JSON.parse(JSON.stringify({ success: true }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

export async function deleteExpenseAction(params: { gymId: string; expenseId: string; branchId: string }) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "expenses:manage",
      targetBranchId: params.branchId,
    });

    if (context.role !== "owner" && context.role !== "partner" && context.role !== "manager") {
      return { success: false, error: "Only owners and managers can delete expense records" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", params.expenseId)
      .eq("gym_id", context.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${params.gymId}/expenses`);
    revalidatePath(`/app/${params.gymId}/expenses/all`);

    return JSON.parse(JSON.stringify({ success: true }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}
