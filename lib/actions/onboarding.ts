"use server";

import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const onboardingSchema = z.object({
  fullName: z.string().min(2, "Owner name must be at least 2 characters"),
  phone: z.string().min(8, "Phone number must be at least 8 digits"),
  gymName: z.string().min(2, "Gym / Business name must be at least 2 characters"),
  branchName: z.string().optional(),
  pilotCode: z.string().optional(),
});

export async function completeOnboardingAction(formData: FormData) {
  const rawData = {
    fullName: (formData.get("fullName") as string)?.trim() || "",
    phone: (formData.get("phone") as string)?.trim() || "",
    gymName: (formData.get("gymName") as string)?.trim() || "",
    branchName: (formData.get("branchName") as string)?.trim() || "Main Branch",
    pilotCode: (formData.get("pilotCode") as string)?.trim() || "",
  };

  const validation = onboardingSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid form data",
    };
  }

  const { fullName, phone, gymName, branchName } = validation.data;
  const effectiveBranchName = branchName?.trim() || "Main Branch";

  const supabase = await createClient();
  const user = await getCachedUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required. Please sign in first.",
    };
  }

  let gymId: string | null = null;
  let branchId: string | null = null;

  // Direct SQL setup with client RLS to guarantee atomic multi-entity workspace creation
  try {
    // A. Upsert profile
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone: phone,
      updated_at: new Date().toISOString(),
    });

    // B. Ensure account with 60-day free pilot
    let accountId: string | null = null;
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    const pilotEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    if (existingAccount) {
      accountId = existingAccount.id;
      // Ensure trial is extended to 60 days for active pilot
      await supabase
        .from("accounts")
        .update({
          subscription_tier: "pro",
          trial_ends_at: pilotEndsAt,
        })
        .eq("id", accountId);
    } else {
      const { data: newAccount, error: accErr } = await supabase
        .from("accounts")
        .insert({
          owner_id: user.id,
          subscription_tier: "pro",
          trial_ends_at: pilotEndsAt,
        })
        .select("id")
        .single();

      if (accErr) throw accErr;
      accountId = newAccount.id;
    }

    // C. Create Gym
    const { data: newGym, error: gymErr } = await supabase
      .from("gyms")
      .insert({
        account_id: accountId,
        name: gymName,
        phone: phone,
      })
      .select("id")
      .single();

    if (gymErr) throw gymErr;
    gymId = newGym.id;

    // D. Create Main Branch
    const { data: newBranch, error: branchErr } = await supabase
      .from("branches")
      .insert({
        gym_id: gymId,
        name: effectiveBranchName,
        phone: phone,
      })
      .select("id")
      .single();

    if (branchErr) throw branchErr;
    branchId = newBranch.id;

    // E. Add owner to gym_users
    const { error: gymUserErr } = await supabase.from("gym_users").insert({
      gym_id: gymId,
      user_id: user.id,
      role: "owner",
      status: "active",
    });

    if (gymUserErr && !gymUserErr.message.includes("duplicate")) {
      throw gymUserErr;
    }
  } catch (err: unknown) {
    console.error("Onboarding error:", err);
    // Fallback: Attempt RPC create_owner_account
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "create_owner_account",
        {
          p_name: fullName,
          p_gym_name: gymName,
          p_phone: phone,
        }
      );
      if (!rpcError && rpcData) {
        const data = rpcData as { gym_id?: string; branch_id?: string };
        gymId = data.gym_id || null;
        branchId = data.branch_id || null;
      } else {
        const msg = err instanceof Error ? err.message : "Unable to set up gym workspace";
        return { success: false, error: msg };
      }
    } catch {
      const msg = err instanceof Error ? err.message : "Unable to set up gym workspace";
      return { success: false, error: msg };
    }
  }

  if (!gymId) {
    const { data: latestMembership } = await supabase
      .from("gym_users")
      .select("gym_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMembership?.gym_id) {
      gymId = latestMembership.gym_id;
    }
  }

  if (gymId) {
    revalidatePath("/select-workspace");
    revalidatePath("/dashboard");
    revalidatePath(`/app/${gymId}/dashboard`);
    redirect(`/app/${gymId}/dashboard`);
  }

  redirect("/dashboard");
}
