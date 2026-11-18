import { z } from "zod";

// ============================================================================
// Offers & Promotional Discounts Validation Schemas
// ============================================================================

export const createOfferSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  title: z
    .string()
    .trim()
    .min(2, "Offer title must be at least 2 characters")
    .max(100, "Offer title too long"),
  discountType: z.enum(["percentage", "flat"], {
    message: "Select discount type (percentage or flat amount)",
  }),
  discountValue: z
    .number()
    .positive("Discount value must be greater than 0")
    .max(1000000, "Discount value too large"),
  maxDiscountAmount: z
    .number()
    .positive("Maximum discount cap must be greater than 0")
    .optional()
    .nullable(),
  applicablePlanIds: z.array(z.string()).default([]),
  targetAudience: z.enum(["all", "new_members", "renewals"]).default("all"),
  usageLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateOfferSchema = z.object({
  id: z.string().min(1, "Offer ID is required"),
  gymId: z.string().uuid("Invalid gym ID"),
  title: z
    .string()
    .trim()
    .min(2, "Offer title must be at least 2 characters")
    .max(100, "Offer title too long"),
  discountType: z.enum(["percentage", "flat"]),
  discountValue: z
    .number()
    .positive("Discount value must be greater than 0")
    .max(1000000, "Discount value too large"),
  maxDiscountAmount: z
    .number()
    .positive("Maximum discount cap must be greater than 0")
    .optional()
    .nullable(),
  applicablePlanIds: z.array(z.string()).default([]),
  targetAudience: z.enum(["all", "new_members", "renewals"]).default("all"),
  usageLimit: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const toggleOfferSchema = z.object({
  id: z.string().min(1, "Offer ID is required"),
  gymId: z.string().uuid("Invalid gym ID"),
  isActive: z.boolean(),
});

export const deleteOfferSchema = z.object({
  id: z.string().min(1, "Offer ID is required"),
  gymId: z.string().uuid("Invalid gym ID"),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type ToggleOfferInput = z.infer<typeof toggleOfferSchema>;
export type DeleteOfferInput = z.infer<typeof deleteOfferSchema>;

// Offer data item representation
export interface OfferItem {
  id: string;
  gymId: string;
  title: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  maxDiscountAmount?: number | null;
  applicablePlanIds: string[];
  applicablePlanNames?: string[];
  targetAudience?: "all" | "new_members" | "renewals";
  usageCount: number;
  usageLimit?: number | null;
  validUntil?: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Calculates the discounted price and savings based on an offer.
 */
export function calculateOfferDiscount(
  basePrice: number,
  offer?: OfferItem | null
): {
  finalPrice: number;
  discountAmount: number;
  label: string;
} {
  if (!offer || !offer.isActive || basePrice <= 0) {
    return {
      finalPrice: basePrice,
      discountAmount: 0,
      label: "No Offer",
    };
  }

  let discount = 0;
  if (offer.discountType === "percentage") {
    discount = (basePrice * offer.discountValue) / 100;
    if (offer.maxDiscountAmount && offer.maxDiscountAmount > 0) {
      discount = Math.min(discount, offer.maxDiscountAmount);
    }
  } else {
    discount = offer.discountValue;
  }

  discount = Math.min(discount, basePrice);
  const finalPrice = Math.max(0, basePrice - discount);

  const label =
    offer.discountType === "percentage"
      ? `${offer.title} -${offer.discountValue}%`
      : `${offer.title} -₹${offer.discountValue}`;

  return {
    finalPrice: Math.round(finalPrice * 100) / 100,
    discountAmount: Math.round(discount * 100) / 100,
    label,
  };
}
