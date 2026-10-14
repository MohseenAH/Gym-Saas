"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

const updateGymProfileSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  name: z.string().min(2, "Gym name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
});

export async function updateGymProfileAction(input: z.infer<typeof updateGymProfileSchema>) {
  try {
    const validated = updateGymProfileSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "settings:manage",
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("gyms")
      .update({
        name: validated.name.trim(),
        phone: validated.phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/settings`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update gym profile";
    return { success: false, error: message };
  }
}

import {
  createPlanAction as baseCreatePlanAction,
  togglePlanAction as baseTogglePlanAction,
} from "@/lib/actions/plans";

const createPlanSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID").optional(),
  name: z.string().min(2, "Plan name must be at least 2 characters"),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day"),
  price: z.number().min(0, "Price cannot be negative"),
});

export async function createPlanAction(input: z.infer<typeof createPlanSchema>) {
  try {
    const validated = createPlanSchema.parse(input);

    let branchId = validated.branchId;
    if (!branchId) {
      const supabase = await createClient();
      const { data: defaultBranch } = await supabase
        .from("branches")
        .select("id")
        .eq("gym_id", validated.gymId)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!defaultBranch?.id) {
        return { success: false, error: "No active branch found to associate plan with" };
      }
      branchId = defaultBranch.id;
    }

    if (!branchId) {
      return { success: false, error: "Target branch ID is required" };
    }

    return await baseCreatePlanAction({
      gymId: validated.gymId,
      branchId,
      name: validated.name,
      durationDays: validated.durationDays,
      price: validated.price,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create membership plan";
    return { success: false, error: message };
  }
}

export async function togglePlanAction(params: {
  gymId: string;
  planId: string;
  isActive: boolean;
}) {
  return await baseTogglePlanAction(params);
}

export async function redeemPilotCodeAction(params: {
  gymId: string;
  code: string;
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "settings:manage",
    });

    const cleanCode = params.code.trim().toUpperCase();
    const VALID_PILOT_CODES = ["PILOT60", "GYMAPRA60", "PILOT-2026", "EARLY-ACCESS"];

    if (!VALID_PILOT_CODES.includes(cleanCode)) {
      return { success: false, error: "Invalid or expired pilot code. Please contact GymApra support." };
    }

    const supabase = await createClient();

    // Fetch gym's account ID
    const { data: gym, error: gymErr } = await supabase
      .from("gyms")
      .select("account_id")
      .eq("id", params.gymId)
      .single();

    if (gymErr || !gym?.account_id) {
      return { success: false, error: "Gym account not found" };
    }

    // Extend trial to 60 days from now
    const pilotEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const { error: accErr } = await supabase
      .from("accounts")
      .update({
        trial_ends_at: pilotEndsAt,
        subscription_tier: "pro",
      })
      .eq("id", gym.account_id);

    if (accErr) {
      return { success: false, error: accErr.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/settings`);
    revalidatePath(`/app/${context.gymId}/dashboard`);

    return {
      success: true,
      message: "Pilot access activated! Your gym now has 60 full days of Pro access.",
      trialEndsAt: pilotEndsAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to redeem pilot code";
    return { success: false, error: message };
  }
}
