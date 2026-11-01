"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { getTodayIST, isMembershipValidForAttendance } from "@/lib/utils";

const staffCheckInSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
});

const memberSelfCheckInSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  memberId: z.string().uuid("Invalid member ID").optional(),
});

export async function staffCheckInAction(params: {
  gymId: string;
  branchId: string;
  memberId: string;
}) {
  try {
    const parseResult = staffCheckInSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid input parameters",
      };
    }

    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "attendance:record",
      targetBranchId: params.branchId,
    });

    const supabase = await createClient();
    const today = getTodayIST();

    // 1. Verify member belongs to this gym workspace
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, branch_id, status, branches!inner(gym_id)")
      .eq("id", params.memberId)
      .eq("branches.gym_id", params.gymId)
      .maybeSingle();

    if (memberError || !member) {
      return { success: false, error: "Member not found in this gym workspace" };
    }

    // 2. Active plan gating: Verify active contract where status = 'active' and end_date >= today
    const { data: activeMembership } = await supabase
      .from("memberships")
      .select("id, status, end_date, membership_plans(name)")
      .eq("member_id", params.memberId)
      .eq("status", "active")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const gate = isMembershipValidForAttendance(activeMembership, today);
    if (!gate.isValid) {
      return {
        success: false,
        error: "Membership expired or inactive. Please renew plan before checking in.",
        isExpired: true,
      };
    }

    // 3. Pre-check for existing check-in today
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
        alreadyCheckedIn: true,
        checkInTime: existing.check_in_time,
      };
    }

    // 4. Insert attendance record
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
      // Gracefully resolve Postgres 23505 unique constraint conflict
      if (
        error.code === "23505" ||
        error.message?.toLowerCase().includes("duplicate") ||
        error.message?.toLowerCase().includes("unique")
      ) {
        const { data: dupCheckIn } = await supabase
          .from("attendance")
          .select("id, check_in_time")
          .eq("member_id", params.memberId)
          .eq("check_in_date", today)
          .maybeSingle();

        return {
          success: true,
          alreadyCheckedIn: true,
          checkInId: dupCheckIn?.id,
          checkInTime: dupCheckIn?.check_in_time,
          message: "Member is already checked in for today",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
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
  memberId?: string;
}) {
  try {
    const parseResult = memberSelfCheckInSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid input parameters",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Authentication required to check in" };
    }

    // 1. Anti-tampering: Derive member strictly from auth user ID and gym context
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, branch_id, status, branches!inner(gym_id)")
      .eq("user_id", user.id)
      .eq("branches.gym_id", params.gymId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !member) {
      return { success: false, error: "Active member record not found or unauthorized" };
    }

    if (params.memberId && params.memberId !== member.id) {
      return { success: false, error: "Unauthorized check-in attempt for another member" };
    }

    const today = getTodayIST();

    // 2. Active plan gating: Verify active contract where status = 'active' and end_date >= today
    const { data: activeMembership } = await supabase
      .from("memberships")
      .select("id, status, end_date, membership_plans(name)")
      .eq("member_id", member.id)
      .eq("status", "active")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const gate = isMembershipValidForAttendance(activeMembership, today);
    if (!gate.isValid) {
      return {
        success: false,
        error: "Membership expired or inactive. Please renew plan before checking in.",
        isExpired: true,
      };
    }

    // 3. Pre-check for existing check-in today
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

    // 4. Insert self check-in record
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
      // Gracefully resolve Postgres 23505 unique constraint conflict
      if (
        error.code === "23505" ||
        error.message?.toLowerCase().includes("duplicate") ||
        error.message?.toLowerCase().includes("unique")
      ) {
        const { data: dupCheckIn } = await supabase
          .from("attendance")
          .select("id, check_in_time")
          .eq("member_id", member.id)
          .eq("check_in_date", today)
          .maybeSingle();

        return {
          success: true,
          alreadyCheckedIn: true,
          checkInId: dupCheckIn?.id,
          checkInTime: dupCheckIn?.check_in_time,
          message: "You have already checked in today!",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${params.gymId}`, "layout");
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
