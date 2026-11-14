"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { generateInvitationToken, buildInvitationLinks } from "@/lib/auth/invitations";
import { getISTDateString, getTodayIST, normalizeIndianPhone } from "@/lib/utils";

const quickEnrollMemberSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  phone: z.string().trim().min(10, "Phone must be at least 10 digits"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().trim().max(500, "Notes too long").optional().nullable(),
  // Optional plan assignment during quick enroll
  planId: z.string().uuid("Invalid plan ID").optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format").optional(),
  amountPaid: z.number().min(0, "Amount paid cannot be negative").optional(),
  discount: z.number().min(0, "Discount cannot be negative").optional().default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
});

export type QuickEnrollMemberInput = z.infer<typeof quickEnrollMemberSchema>;

export async function quickEnrollMemberAction(input: QuickEnrollMemberInput) {
  try {
    const validated = quickEnrollMemberSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Phone number normalization and duplication check within this gym
    const phoneRes = normalizeIndianPhone(validated.phone);
    if (!phoneRes.isValid) {
      return { success: false, error: phoneRes.error || "Please enter a valid phone number" };
    }
    const normalizedPhone = phoneRes.phone;

    const { data: existingMember } = await supabase
      .from("members")
      .select("id, full_name, phone, branches!inner(gym_id)")
      .eq("branches.gym_id", context.gymId)
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingMember) {
      return {
        success: false,
        error: `A member with phone number ${normalizedPhone} already exists (${existingMember.full_name}).`,
      };
    }

    // Fetch gym name for WhatsApp receipt and branding
    const { data: gymData } = await supabase
      .from("gyms")
      .select("name")
      .eq("id", context.gymId)
      .single();
    const gymName = gymData?.name || "the gym";

    // 2. Create member record with explicit gym_id
    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        gym_id: context.gymId,
        branch_id: validated.branchId,
        full_name: validated.fullName,
        phone: normalizedPhone,
        email: validated.email || null,
        notes: validated.notes || null,
        status: "active",
      })
      .select("id, full_name, phone")
      .single();

    if (memberError || !member) {
      return { success: false, error: `Failed to create member: ${memberError?.message}` };
    }

    let membershipId: string | null = null;
    let planData: { id: string; name: string; duration_days: number; price: number } | null = null;
    let startDateStr = getTodayIST();
    let endDateStr = getTodayIST();
    let pendingDues = 0;
    const discount = validated.discount || 0;
    const amountPaid = validated.amountPaid !== undefined && validated.amountPaid !== null ? validated.amountPaid : 0;

    // 3. If plan selected, create membership contract and initial payment (if amount > 0)
    if (validated.planId) {
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("id, name, duration_days, price")
        .eq("id", validated.planId)
        .single();

      if (plan) {
        planData = plan;
        const planPrice = Number(plan.price);
        pendingDues = Math.max(0, planPrice - discount - amountPaid);

        startDateStr = validated.startDate || getTodayIST();
        const start = new Date(startDateStr + "T00:00:00+05:30");
        const end = new Date(start);
        end.setDate(end.getDate() + plan.duration_days - 1);
        endDateStr = getISTDateString(end);

        const { data: membership, error: memError } = await supabase
          .from("memberships")
          .insert({
            member_id: member.id,
            plan_id: plan.id,
            start_date: startDateStr,
            end_date: endDateStr,
            status: "active",
            notes: `Enrolled on ${plan.name}${discount > 0 ? ` (Discount: ₹${discount})` : ""}`,
          })
          .select("id")
          .single();

        if (!memError && membership) {
          membershipId = membership.id;

          // Only insert payment record if amount > 0 (database CHECK constraint: amount > 0)
          if (amountPaid > 0) {
            const isFull = amountPaid >= (planPrice - discount);
            const isPartial = amountPaid > 0 && !isFull;
            const paymentStatus = isFull ? "paid" : isPartial ? "partial" : "pending";

            await supabase.from("payments").insert({
              gym_id: context.gymId,
              branch_id: validated.branchId,
              member_id: member.id,
              membership_id: membership.id,
              amount: amountPaid,
              payment_method: validated.paymentMethod,
              payment_status: paymentStatus,
              payment_date: startDateStr,
              notes: `Enrollment fee for ${plan.name}${discount > 0 ? ` (Discount: ₹${discount})` : ""}`,
              created_by: context.userId,
            });
          }
        }
      }
    }

    // 4. Generate Portal Invitation Token for 1-Click WhatsApp Self-Claim
    const { rawToken, tokenHash } = generateInvitationToken();

    await supabase.from("invitations").insert({
      gym_id: context.gymId,
      email: validated.email || `${normalizedPhone}@placeholder.gym`,
      type: "member",
      role: "member",
      branch_ids: [validated.branchId],
      member_id: member.id,
      token_hash: tokenHash,
      status: "pending",
      invited_by: context.userId,
    });

    const links = buildInvitationLinks({
      type: "member",
      rawToken,
      gymName,
      recipientName: validated.fullName,
      recipientPhone: normalizedPhone,
    });
    const inviteUrl = links.inviteUrl;

    // Build rich, robust WhatsApp welcome and receipt message
    const waPhone = normalizedPhone.length === 10 ? `91${normalizedPhone}` : normalizedPhone;
    let waMessage = `👋 Hello ${validated.fullName.trim()}!\n\n` +
      `Welcome to *${gymName}*! 🎉\n` +
      `Your member profile has been registered successfully.\n`;

    if (planData) {
      waMessage += `\n📋 *Membership Details:*\n` +
        `• Plan: ${planData.name}\n` +
        `• Validity: ${startDateStr} to ${endDateStr} (${planData.duration_days} days)\n` +
        `• Plan Fee: ₹${Number(planData.price).toFixed(2)}\n`;

      if (discount > 0) {
        waMessage += `• Discount: -₹${discount.toFixed(2)}\n`;
      }
      if (amountPaid > 0) {
        waMessage += `• Amount Paid: ₹${amountPaid.toFixed(2)} (${validated.paymentMethod.toUpperCase()})\n`;
      }
      if (pendingDues > 0) {
        waMessage += `• Pending Dues: ₹${pendingDues.toFixed(2)}\n`;
      } else {
        waMessage += `• Payment Status: Paid in Full ✅\n`;
      }
    }

    waMessage += `\n📲 *Member Portal & Digital Pass:*\n` +
      `Track workouts, check-in history, and receipts here:\n` +
      `${inviteUrl}\n\n` +
      `See you at the gym! 💪`;

    const waShareUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/memberships`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/attendance`);
    revalidatePath(`/app/${context.gymId}/reports`);

    return {
      success: true,
      memberId: member.id,
      membershipId,
      inviteUrl,
      waShareUrl,
      pendingDues,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to enroll member";
    return { success: false, error: message };
  }
}

const updateMemberSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  memberId: z.string().uuid("Invalid member ID"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  branchId: z.string().uuid("Invalid branch ID"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  notes: z.string().optional().nullable(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export async function updateMemberAction(input: UpdateMemberInput) {
  try {
    const validated = updateMemberSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const phoneRes = normalizeIndianPhone(validated.phone);
    if (!phoneRes.isValid) {
      return { success: false, error: phoneRes.error || "Please enter a valid phone number" };
    }

    const supabase = await createClient();

    // Check for phone collision with another member in this gym
    const { data: existingMember } = await supabase
      .from("members")
      .select("id, full_name, phone, branches!inner(gym_id)")
      .eq("branches.gym_id", context.gymId)
      .eq("phone", phoneRes.phone)
      .neq("id", validated.memberId)
      .maybeSingle();

    if (existingMember) {
      return {
        success: false,
        error: `A member with phone number ${phoneRes.phone} already exists (${existingMember.full_name}).`,
      };
    }

    const { error } = await supabase
      .from("members")
      .update({
        full_name: validated.fullName,
        phone: phoneRes.phone,
        email: validated.email || null,
        branch_id: validated.branchId,
        status: validated.status,
        notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.memberId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/members/${validated.memberId}`);
    revalidatePath(`/app/${context.gymId}/dashboard`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update member";
    return { success: false, error: message };
  }
}

const renewMembershipSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  planId: z.string().uuid("Invalid plan ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  amountPaid: z.number().min(0, "Amount paid cannot be negative").default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  notes: z.string().trim().max(500, "Notes too long").optional().nullable(),
});

export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;

export async function renewMembershipAction(input: RenewMembershipInput) {
  try {
    const validated = renewMembershipSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("id, name, duration_days, price, is_active")
      .eq("id", validated.planId)
      .single();

    if (planErr || !plan) {
      return { success: false, error: "Membership plan not found" };
    }

    if (!plan.is_active) {
      return { success: false, error: "Cannot renew with an inactive membership plan" };
    }

    const todayIST = getTodayIST();

    // 2. Fetch member's current active membership to compute rollover stacking
    const { data: currentActiveMembership } = await supabase
      .from("memberships")
      .select("id, start_date, end_date, status")
      .eq("member_id", validated.memberId)
      .eq("status", "active")
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let computedStartDate: string;

    if (currentActiveMembership && currentActiveMembership.end_date) {
      const currentEndDateStr = currentActiveMembership.end_date;
      if (currentEndDateStr >= todayIST) {
        // Early or On-Time renewal (current_end_date >= Today IST):
        // New start date must strictly stack onto current_end_date + 1 day!
        const nextDay = new Date(currentEndDateStr + "T00:00:00+05:30");
        nextDay.setDate(nextDay.getDate() + 1);
        computedStartDate = getISTDateString(nextDay);
      } else {
        // Late renewal (current_end_date < Today IST):
        // Defaults to Today IST (or custom validated.startDate if specified and >= Today IST)
        computedStartDate = validated.startDate && validated.startDate >= todayIST
          ? validated.startDate
          : todayIST;
      }
    } else {
      // No existing active membership: starts on validated.startDate or Today IST
      computedStartDate = validated.startDate || todayIST;
    }

    // Compute contract end date from computedStartDate + duration_days - 1
    const startObj = new Date(computedStartDate + "T00:00:00+05:30");
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + plan.duration_days - 1);

    const startDateStr = computedStartDate;
    const endDateStr = getISTDateString(endObj);

    // 3. Transition prior active membership status
    // If it was renewed before expiring -> 'renewed'
    // If it was already past its end date -> 'completed'
    if (currentActiveMembership) {
      const priorStatus = currentActiveMembership.end_date >= todayIST ? "renewed" : "completed";
      await supabase
        .from("memberships")
        .update({
          status: priorStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentActiveMembership.id);
    }

    // 4. Create new membership contract as 'active'
    const { data: newMembership, error: memErr } = await supabase
      .from("memberships")
      .insert({
        member_id: validated.memberId,
        plan_id: plan.id,
        start_date: startDateStr,
        end_date: endDateStr,
        status: "active",
        notes: validated.notes || `Renewed with ${plan.name} (${startDateStr} to ${endDateStr})`,
      })
      .select("id")
      .single();

    if (memErr || !newMembership) {
      return { success: false, error: `Failed to create membership: ${memErr?.message}` };
    }

    // 5. If amount paid > 0, record initial payment (database CHECK constraint: amount > 0)
    let paymentId: string | null = null;
    const amountPaid = validated.amountPaid || 0;
    if (amountPaid > 0) {
      const planPrice = Number(plan.price);
      const isFull = amountPaid >= planPrice;
      const paymentStatus = isFull ? "paid" : "partial";

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          gym_id: context.gymId,
          branch_id: validated.branchId,
          member_id: validated.memberId,
          membership_id: newMembership.id,
          amount: amountPaid,
          payment_method: validated.paymentMethod,
          payment_status: paymentStatus,
          payment_date: todayIST,
          notes: validated.notes || `Renewal fee for ${plan.name}`,
          created_by: context.userId,
        })
        .select("id")
        .single();

      if (!payErr && payment) {
        paymentId = payment.id;
      }
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/members/${validated.memberId}`);
    revalidatePath(`/app/${context.gymId}/memberships`);
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);

    return {
      success: true,
      membershipId: newMembership.id,
      paymentId,
      startDate: startDateStr,
      endDate: endDateStr,
      planName: plan.name,
      stacked: Boolean(currentActiveMembership && currentActiveMembership.end_date >= todayIST),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to renew membership";
    return { success: false, error: message };
  }
}

export type ImportRowStatus = "VALID" | "ALREADY_EXISTS" | "INVALID";

export interface PreviewImportRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: {
    fullName: string;
    phone: string;
    email: string | null;
    notes: string | null;
  };
  status: ImportRowStatus;
  reasons: string[];
}

export interface BulkImportPreviewResult {
  success: boolean;
  summary: {
    totalRows: number;
    validCount: number;
    alreadyExistsCount: number;
    invalidCount: number;
  };
  rows: PreviewImportRow[];
  canProceed: boolean;
  error?: string;
}

export interface BulkImportExecutionResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors?: Array<{ row: number; phone: string; error: string }>;
  error?: string;
}

export async function previewBulkImportMembersAction(
  gymId: string,
  branchId: string,
  rawRows: Array<Record<string, unknown>>
): Promise<BulkImportPreviewResult> {
  try {
    if (!gymId || !branchId) {
      return {
        success: false,
        summary: { totalRows: 0, validCount: 0, alreadyExistsCount: 0, invalidCount: 0 },
        rows: [],
        canProceed: false,
        error: "Gym ID and Branch ID are required",
      };
    }

    const context = await getAuthorizedActionContext({
      gymId,
      capability: "members:manage",
      targetBranchId: branchId,
    });

    if (!Array.isArray(rawRows)) {
      return {
        success: false,
        summary: { totalRows: 0, validCount: 0, alreadyExistsCount: 0, invalidCount: 0 },
        rows: [],
        canProceed: false,
        error: "Invalid input: rawRows must be an array",
      };
    }

    if (rawRows.length > 500) {
      return {
        success: false,
        summary: { totalRows: rawRows.length, validCount: 0, alreadyExistsCount: 0, invalidCount: rawRows.length },
        rows: [],
        canProceed: false,
        error: "Maximum batch limit is 500 rows per import.",
      };
    }

    const seenPhonesInFile = new Map<string, number>();
    const previewRows: PreviewImportRow[] = [];
    const validCandidatePhones: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] || {};
      const reasons: string[] = [];

      // Flexible column key extraction
      const rawFullName =
        row["Full Name"] ??
        row["fullName"] ??
        row["full_name"] ??
        row["Name"] ??
        row["name"] ??
        "";
      const rawPhone =
        row["Phone"] ??
        row["phone"] ??
        row["Mobile"] ??
        row["mobile"] ??
        row["Contact"] ??
        "";
      const rawEmail =
        row["Email"] ??
        row["email"] ??
        row["Email Address"] ??
        "";
      const rawNotes =
        row["Notes"] ??
        row["notes"] ??
        row["Note"] ??
        row["note"] ??
        "";

      const fullName = typeof rawFullName === "string" ? rawFullName.trim() : String(rawFullName || "").trim();
      const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim().toLowerCase() : null;
      const notes = typeof rawNotes === "string" && rawNotes.trim() ? rawNotes.trim() : null;

      if (!fullName || fullName.length < 2) {
        reasons.push("Full Name must be at least 2 characters");
      } else if (fullName.length > 100) {
        reasons.push("Full Name cannot exceed 100 characters");
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        reasons.push("Invalid email address format");
      }

      if (notes && notes.length > 500) {
        reasons.push("Notes cannot exceed 500 characters");
      }

      const phoneRes = normalizeIndianPhone(rawPhone);
      let normalizedPhone = "";

      if (!phoneRes.isValid) {
        reasons.push(phoneRes.error || "Invalid phone number format");
      } else {
        normalizedPhone = phoneRes.phone;
        // Check intra-file duplicate
        if (seenPhonesInFile.has(normalizedPhone)) {
          const prevRow = seenPhonesInFile.get(normalizedPhone);
          reasons.push(`Duplicate phone number within this import file (matches row ${prevRow})`);
        } else {
          seenPhonesInFile.set(normalizedPhone, i + 1);
        }
      }

      const status: ImportRowStatus = reasons.length > 0 ? "INVALID" : "VALID";
      if (status === "VALID") {
        validCandidatePhones.push(normalizedPhone);
      }

      previewRows.push({
        rowIndex: i + 1,
        raw: row,
        parsed: {
          fullName,
          phone: normalizedPhone,
          email,
          notes,
        },
        status,
        reasons,
      });
    }

    // 4. Batch Database Existence Check against Gym
    if (validCandidatePhones.length > 0) {
      const supabase = await createClient();
      const uniqueCandidatePhones = Array.from(new Set(validCandidatePhones));

      const { data: existingMembers, error: dbErr } = await supabase
        .from("members")
        .select("id, full_name, phone, branch_id, branches!inner(id, name, gym_id)")
        .eq("branches.gym_id", context.gymId)
        .in("phone", uniqueCandidatePhones);

      if (!dbErr && existingMembers && existingMembers.length > 0) {
        const existingMap = new Map<string, { fullName: string; branchName: string }>();
        for (const m of existingMembers) {
          const branch = m.branches as unknown as { name?: string };
          existingMap.set(m.phone, {
            fullName: m.full_name,
            branchName: branch?.name || "Main Branch",
          });
        }

        for (const row of previewRows) {
          if (row.status === "VALID" && existingMap.has(row.parsed.phone)) {
            const existing = existingMap.get(row.parsed.phone)!;
            row.status = "ALREADY_EXISTS";
            row.reasons.push(
              `Phone already registered to ${existing.fullName} in branch ${existing.branchName}`
            );
          }
        }
      }
    }

    const validCount = previewRows.filter((r) => r.status === "VALID").length;
    const alreadyExistsCount = previewRows.filter((r) => r.status === "ALREADY_EXISTS").length;
    const invalidCount = previewRows.filter((r) => r.status === "INVALID").length;

    return {
      success: true,
      summary: {
        totalRows: previewRows.length,
        validCount,
        alreadyExistsCount,
        invalidCount,
      },
      rows: previewRows,
      canProceed: validCount > 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to preview member import";
    return {
      success: false,
      summary: { totalRows: 0, validCount: 0, alreadyExistsCount: 0, invalidCount: 0 },
      rows: [],
      canProceed: false,
      error: message,
    };
  }
}

export interface RowToImport {
  fullName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export async function bulkImportMembersAction(
  gymId: string,
  branchId: string,
  rowsToImport: RowToImport[]
): Promise<BulkImportExecutionResult> {
  try {
    if (!gymId || !branchId) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        error: "Gym ID and Branch ID are required",
      };
    }

    const context = await getAuthorizedActionContext({
      gymId,
      capability: "members:manage",
      targetBranchId: branchId,
    });

    if (!Array.isArray(rowsToImport) || rowsToImport.length === 0) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        error: "No rows provided for import",
      };
    }

    if (rowsToImport.length > 500) {
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        failedCount: rowsToImport.length,
        error: "Cannot import more than 500 rows at once",
      };
    }

    // 1. Zero-Trust Server Re-validation
    const seenPhonesInBatch = new Set<string>();
    const sanitizedRows: Array<{
      fullName: string;
      phone: string;
      email: string | null;
      notes: string | null;
    }> = [];

    let skippedCount = 0;

    for (const item of rowsToImport) {
      const fullName = (item.fullName || "").trim();
      const phoneRes = normalizeIndianPhone(item.phone);

      if (!fullName || fullName.length < 2 || !phoneRes.isValid) {
        skippedCount++;
        continue;
      }

      if (seenPhonesInBatch.has(phoneRes.phone)) {
        skippedCount++;
        continue;
      }
      seenPhonesInBatch.add(phoneRes.phone);

      const email = item.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim())
        ? item.email.trim().toLowerCase()
        : null;
      const notes = item.notes && item.notes.trim() ? item.notes.trim().slice(0, 500) : null;

      sanitizedRows.push({
        fullName: fullName.slice(0, 100),
        phone: phoneRes.phone,
        email,
        notes,
      });
    }

    if (sanitizedRows.length === 0) {
      return {
        success: true,
        importedCount: 0,
        skippedCount,
        failedCount: 0,
      };
    }

    // 2. Concurrency Check: Filter out phones already in DB to prevent duplicates
    const supabase = await createClient();
    const candidatePhones = sanitizedRows.map((r) => r.phone);

    const { data: existingMembers } = await supabase
      .from("members")
      .select("phone, branches!inner(gym_id)")
      .eq("branches.gym_id", context.gymId)
      .in("phone", candidatePhones);

    const existingSet = new Set((existingMembers || []).map((m) => m.phone));
    const recordsToInsert = sanitizedRows
      .filter((r) => !existingSet.has(r.phone))
      .map((r) => ({
        gym_id: context.gymId,
        branch_id: branchId,
        full_name: r.fullName,
        phone: r.phone,
        email: r.email,
        notes: r.notes,
        status: "active" as const,
      }));

    skippedCount += sanitizedRows.length - recordsToInsert.length;

    if (recordsToInsert.length === 0) {
      return {
        success: true,
        importedCount: 0,
        skippedCount,
        failedCount: 0,
      };
    }

    // 3. Batch Insertion in chunks of 100
    // Invariant: Writes strictly to 'members' table only.
    let importedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recordsToInsert.length; i += 100) {
      const chunk = recordsToInsert.slice(i, i + 100);
      const { error: insertErr } = await supabase.from("members").insert(chunk);

      if (insertErr) {
        // If PostgreSQL error 23505 (unique_violation) occurs concurrently, retry per-row to save valid ones
        if (insertErr.code === "23505") {
          for (const singleRecord of chunk) {
            const { error: singleErr } = await supabase.from("members").insert(singleRecord);
            if (!singleErr) {
              importedCount++;
            } else {
              failedCount++;
            }
          }
        } else {
          return {
            success: false,
            importedCount,
            skippedCount,
            failedCount: failedCount + chunk.length,
            error: `Database insertion error: ${insertErr.message}`,
          };
        }
      } else {
        importedCount += chunk.length;
      }
    }

    // Invalidate affected paths
    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/getting-started`);

    return {
      success: true,
      importedCount,
      skippedCount,
      failedCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to execute bulk member import";
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      failedCount: rowsToImport.length,
      error: message,
    };
  }
}
