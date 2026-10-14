"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

export async function staffCheckInAction(params: {
  gymId: string;
  branchId: string;
  memberId: string;
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "attendance:record",
      targetBranchId: params.branchId,
    });

    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Check if already checked in
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, check_in_time")
      .eq("member_id", params.memberId)
      .eq("check_in_date", today)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Member has already checked in today",
        checkInTime: existing.check_in_time,
      };
    }

    const { data: checkIn, error } = await supabase
      .from("attendance")
      .insert({
        branch_id: params.branchId,
        member_id: params.memberId,
        check_in_date: today,
        check_in_method: "staff_manual",
        verified_by: context.userId,
      })
      .select("id, check_in_time")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/attendance`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/attendance`);

    return { success: true, checkInId: checkIn.id, checkInTime: checkIn.check_in_time };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record attendance";
    return { success: false, error: message };
  }
}

export async function memberSelfCheckInAction(params: {
  gymId: string;
  memberId: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Authentication required to check in" };
    }

    // Verify member record belongs to this authenticated user
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, branch_id, status, branches!inner(gym_id)")
      .eq("id", params.memberId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (memberError || !member) {
      return { success: false, error: "Active member record not found or unauthorized" };
    }

    const today = new Date().toISOString().split("T")[0];

    // Check for existing check-in today
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, check_in_time")
      .eq("member_id", member.id)
      .eq("check_in_date", today)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "You have already checked in today!",
        alreadyCheckedIn: true,
        checkInTime: existing.check_in_time,
      };
    }

    const { data: checkIn, error } = await supabase
      .from("attendance")
      .insert({
        branch_id: member.branch_id,
        member_id: member.id,
        check_in_date: today,
        check_in_method: "member_portal",
      })
      .select("id, check_in_time")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/portal/${params.gymId}/attendance`);
    revalidatePath(`/portal/${params.gymId}/dashboard`);
    revalidatePath(`/app/${params.gymId}/attendance`);

    return {
      success: true,
      message: "Checked in successfully! Enjoy your workout 💪",
      checkInId: checkIn.id,
      checkInTime: checkIn.check_in_time,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to self check in";
    return { success: false, error: message };
  }
}
