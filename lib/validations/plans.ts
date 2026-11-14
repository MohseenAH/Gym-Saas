import { z } from "zod";

// ============================================================================
// Plans Validation Schemas
// ============================================================================

export const createPlanSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  name: z.string().trim().min(2, "Plan name must be at least 2 characters").max(100, "Plan name too long"),
  description: z.string().trim().max(500, "Description too long").optional().nullable(),
  durationDays: z.number().int("Duration must be an integer").min(1, "Duration must be at least 1 day").max(3650, "Duration cannot exceed 3,650 days (10 years)"),
  price: z.number().min(0, "Price cannot be negative").max(10000000, "Price cannot exceed ₹1,00,00,000"),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  planId: z.string().uuid("Invalid plan ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  name: z.string().trim().min(2, "Plan name must be at least 2 characters").max(100, "Plan name too long"),
  description: z.string().trim().max(500, "Description too long").optional().nullable(),
  durationDays: z.number().int("Duration must be an integer").min(1, "Duration must be at least 1 day").max(3650, "Duration cannot exceed 3,650 days (10 years)"),
  price: z.number().min(0, "Price cannot be negative").max(10000000, "Price cannot exceed ₹1,00,00,000"),
  isActive: z.boolean().optional(),
});

export const togglePlanSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  planId: z.string().uuid("Invalid plan ID"),
  isActive: z.boolean(),
});

export const deletePlanSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  planId: z.string().uuid("Invalid plan ID"),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type TogglePlanInput = z.infer<typeof togglePlanSchema>;
export type DeletePlanInput = z.infer<typeof deletePlanSchema>;
