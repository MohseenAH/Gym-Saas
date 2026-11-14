import { z } from "zod";

// ============================================================================
// Membership Assignment Validation Schemas
// ============================================================================

export const assignMembershipSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  planId: z.string().uuid("Invalid plan ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
  amountPaid: z.number().min(0, "Amount paid cannot be negative").default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
});

export const bulkAssignMembershipsSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberIds: z.array(z.string().uuid("Invalid member ID")).min(1, "Select at least 1 member"),
  planId: z.string().uuid("Invalid plan ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
});

export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;
export type BulkAssignMembershipsInput = z.infer<typeof bulkAssignMembershipsSchema>;
