"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

const createBranchSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export async function createBranchAction(input: z.infer<typeof createBranchSchema>) {
  try {
    const validated = createBranchSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "branches:manage",
    });

    const supabase = await createClient();

    const { data: branch, error } = await supabase
      .from("branches")
      .insert({
        gym_id: validated.gymId,
        name: validated.name.trim(),
        address: validated.address?.trim() || null,
        city: validated.city?.trim() || null,
        phone: validated.phone?.trim() || null,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/branches`);
    revalidatePath(`/app/${context.gymId}/settings`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    return { success: true, branchId: branch.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create branch";
    return { success: false, error: message };
  }
}

const updateBranchSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function updateBranchAction(input: z.infer<typeof updateBranchSchema>) {
  try {
    const validated = updateBranchSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "branches:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("branches")
      .update({
        name: validated.name.trim(),
        address: validated.address?.trim() || null,
        city: validated.city?.trim() || null,
        phone: validated.phone?.trim() || null,
        is_active: validated.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.branchId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/branches`);
    revalidatePath(`/app/${context.gymId}/settings`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update branch";
    return { success: false, error: message };
  }
}
