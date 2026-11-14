"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import {
  createPlanSchema,
  updatePlanSchema,
  togglePlanSchema,
  deletePlanSchema,
  type CreatePlanInput,
  type UpdatePlanInput,
  type TogglePlanInput,
  type DeletePlanInput,
} from "@/lib/validations/plans";

export type {
  CreatePlanInput,
  UpdatePlanInput,
  TogglePlanInput,
  DeletePlanInput,
};

// ============================================================================
// 2. Server Actions
// ============================================================================

/**
 * Creates a new membership plan template.
 * Strictly verifies `plans:manage` capability and branch authorization.
 */
export async function createPlanAction(input: CreatePlanInput) {
  try {
    const validated = createPlanSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "plans:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // Verify branch belongs to gym
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("id, gym_id")
      .eq("id", validated.branchId)
      .eq("gym_id", context.gymId)
      .single();

    if (branchErr || !branch) {
      return { success: false, error: "Target branch not found or unauthorized" };
    }

    const { data: newPlan, error } = await supabase
      .from("membership_plans")
      .insert({
        branch_id: validated.branchId,
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
        duration_days: validated.durationDays,
        price: validated.price,
        is_active: validated.isActive !== undefined ? validated.isActive : true,
      })
      .select("id, name, price, duration_days, is_active")
      .single();

    if (error || !newPlan) {
      return { success: false, error: error?.message || "Failed to create plan" };
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
        planId: newPlan.id,
        plan: newPlan,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Updates an existing membership plan.
 * Historical Integrity Rule:
 * If the plan is already referenced by existing memberships and the price or duration is changed,
 * we do NOT mutate existing contracts retroactively. Instead, we deactivate the old plan row
 * and create a new plan version so active and historical contracts keep their original terms.
 */
export async function updatePlanAction(input: UpdatePlanInput) {
  try {
    const validated = updatePlanSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "plans:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Fetch current plan with branch check
    const { data: existingPlan, error: fetchErr } = await supabase
      .from("membership_plans")
      .select("id, branch_id, name, description, duration_days, price, is_active, branches!inner(gym_id)")
      .eq("id", validated.planId)
      .single();

    if (fetchErr || !existingPlan) {
      return { success: false, error: "Membership plan not found" };
    }

    // Verify gym isolation
    const planGymId = (existingPlan.branches as unknown as { gym_id: string })?.gym_id;
    if (planGymId && planGymId !== context.gymId) {
      return { success: false, error: "Unauthorized: plan belongs to another gym" };
    }

    // 2. Check if plan is referenced by any existing memberships
    const { count: membershipCount, error: countErr } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", validated.planId);

    if (countErr) {
      return { success: false, error: `Failed to check plan usage: ${countErr.message}` };
    }

    const hasMemberships = (membershipCount ?? 0) > 0;
    const priceChanged = Number(existingPlan.price) !== Number(validated.price);
    const durationChanged = Number(existingPlan.duration_days) !== Number(validated.durationDays);

    // 3. Historical Integrity Branching:
    // If price or duration changed AND memberships already reference it, preserve history!
    if (hasMemberships && (priceChanged || durationChanged)) {
      // Step A: Deactivate previous plan version so no new memberships pick it up
      await supabase
        .from("membership_plans")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.planId);

      // Step B: Insert the new plan version with the updated terms
      const { data: newVersion, error: insertErr } = await supabase
        .from("membership_plans")
        .insert({
          branch_id: validated.branchId,
          name: validated.name.trim(),
          description: validated.description?.trim() || null,
          duration_days: validated.durationDays,
          price: validated.price,
          is_active: validated.isActive !== undefined ? validated.isActive : true,
        })
        .select("id")
        .single();

      if (insertErr || !newVersion) {
        return { success: false, error: `Failed to create new plan version: ${insertErr?.message}` };
      }

      return JSON.parse(
        JSON.stringify({
          success: true,
          planId: newVersion.id,
          versioned: true,
          message: "Plan updated with historical terms preserved for existing members.",
        })
      );
    }

    // 4. In-place update: either no memberships reference it yet, or terms (price/duration) did not change
    const { error: updateErr } = await supabase
      .from("membership_plans")
      .update({
        branch_id: validated.branchId,
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
        duration_days: validated.durationDays,
        price: validated.price,
        is_active: validated.isActive !== undefined ? validated.isActive : existingPlan.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.planId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
        planId: validated.planId,
        versioned: false,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Toggles a plan active/inactive status.
 */
export async function togglePlanAction(input: TogglePlanInput) {
  try {
    const validated = togglePlanSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "plans:manage",
    });

    const supabase = await createClient();

    // Verify tenant
    const { data: plan, error: fetchErr } = await supabase
      .from("membership_plans")
      .select("id, branch_id, branches!inner(gym_id)")
      .eq("id", validated.planId)
      .single();

    if (fetchErr || !plan) {
      return { success: false, error: "Membership plan not found" };
    }

    const planGymId = (plan.branches as unknown as { gym_id: string })?.gym_id;
    if (planGymId && planGymId !== context.gymId) {
      return { success: false, error: "Unauthorized plan modification" };
    }

    const { error: updateErr } = await supabase
      .from("membership_plans")
      .update({
        is_active: validated.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.planId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Safely deletes a membership plan or returns a clean rejection if memberships reference it.
 */
export async function deletePlanAction(input: DeletePlanInput) {
  try {
    const validated = deletePlanSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "plans:manage",
    });

    const supabase = await createClient();

    // 1. Verify tenant isolation
    const { data: plan, error: fetchErr } = await supabase
      .from("membership_plans")
      .select("id, name, branch_id, branches!inner(gym_id)")
      .eq("id", validated.planId)
      .single();

    if (fetchErr || !plan) {
      return { success: false, error: "Membership plan not found" };
    }

    const planGymId = (plan.branches as unknown as { gym_id: string })?.gym_id;
    if (planGymId && planGymId !== context.gymId) {
      return { success: false, error: "Unauthorized plan deletion" };
    }

    // 2. Check for referencing memberships
    const { count: membershipCount, error: countErr } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", validated.planId);

    if (countErr) {
      return { success: false, error: `Failed to check plan usage: ${countErr.message}` };
    }

    // If referenced by existing active or historical memberships, BLOCK hard deletion
    if ((membershipCount ?? 0) > 0) {
      return {
        success: false,
        error: "Cannot delete plan with existing member contracts. Archive it instead.",
      };
    }

    // 3. Safe hard deletion for unreferenced plan
    const { error: deleteErr } = await supabase
      .from("membership_plans")
      .delete()
      .eq("id", validated.planId);

    if (deleteErr) {
      return { success: false, error: deleteErr.message };
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
        archived: false,
        message: `Plan "${plan.name}" has been permanently deleted.`,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}
