"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  const { fullName, phone, gymName, branchName, pilotCode } = validation.data;
  const effectiveBranchName = branchName?.trim() || "Main Branch";

  const cleanPilotCode = pilotCode?.trim().toUpperCase() || "";
  const VALID_PILOT_CODES = ["PILOT60", "GYMAPRA60", "PILOT-2026", "EARLY-ACCESS"];
  if (cleanPilotCode !== "" && !VALID_PILOT_CODES.includes(cleanPilotCode)) {
    return {
      success: false,
      error: "Invalid pilot code. Please leave blank for standard 14-day trial, or enter a valid partner invite code.",
    };
  }
  const isPilotEligible = cleanPilotCode !== "" && VALID_PILOT_CODES.includes(cleanPilotCode);

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required. Please sign in first.",
    };
  }

  let gymId: string | null = null;
  let branchId: string | null = null;

  // 1. Attempt using create_owner_account RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_owner_account",
    {
      p_name: fullName,
      p_gym_name: gymName,
      p_phone: phone,
    }
  );

  type OnboardingRpcResult = { gym_id?: string; branch_id?: string; account_id?: string };

  if (!rpcError && rpcData) {
    const data = rpcData as unknown as OnboardingRpcResult;
    gymId = data.gym_id || null;
    branchId = data.branch_id || null;
  } else {
    // Direct SQL fallback via client RLS
      // Direct SQL fallback via client RLS
      try {
        // A. Upsert profile
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name: fullName,
            phone: phone,
            updated_at: new Date().toISOString(),
          });

        // B. Ensure account
        let accountId: string | null = null;
        const { data: existingAccount } = await supabase
          .from("accounts")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (existingAccount) {
          accountId = existingAccount.id;
        } else {
          const cleanPilotCode = validation.data.pilotCode?.trim().toUpperCase() || "";
          const VALID_PILOT_CODES = ["PILOT60", "GYMAPRA60", "PILOT-2026", "EARLY-ACCESS"];
          const isPilotEligible = VALID_PILOT_CODES.includes(cleanPilotCode);

          const trialDays = isPilotEligible ? 60 : 14;
          const tier = isPilotEligible ? "pro" : "starter";
          const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

          const { data: newAccount, error: accErr } = await supabase
            .from("accounts")
            .insert({
              owner_id: user.id,
              subscription_tier: tier,
              trial_ends_at: trialEndsAt,
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
      } catch (fallbackErr: unknown) {
        console.error("Direct onboarding fallback error:", fallbackErr);
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : undefined;
        return {
          success: false,
          error:
            fallbackMsg ||
            rpcError?.message ||
            "Unable to set up gym workspace. Please ensure database schema is applied.",
        };
      }
    }

  // Update branch name if customized and not already named
  if (branchId && effectiveBranchName !== "Main Branch") {
    try {
      await supabase
        .from("branches")
        .update({ name: effectiveBranchName })
        .eq("id", branchId);
    } catch {
      // non-fatal
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
    if (isPilotEligible) {
      try {
        const { data: gymRec } = await supabase
          .from("gyms")
          .select("account_id")
          .eq("id", gymId)
          .single();

        if (gymRec?.account_id) {
          const pilotEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from("accounts")
            .update({
              subscription_tier: "pro",
              trial_ends_at: pilotEndsAt,
            })
            .eq("id", gymRec.account_id);
        }
      } catch (e) {
        console.warn("Failed to apply pilot entitlement during onboarding:", e);
      }
    }

    redirect(`/app/${gymId}/dashboard`);
  }

  redirect("/dashboard");
}
