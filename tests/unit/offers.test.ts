import { describe, it, expect } from "vitest";
import {
  createOfferSchema,
  updateOfferSchema,
  calculateOfferDiscount,
  type OfferItem,
} from "../../lib/validations/offers";

describe("Offers & Discounts Validation Suite", () => {
  const validGymId = "11111111-1111-4111-a111-111111111111";

  it("validates valid percentage discount offer creation", () => {
    const input = {
      gymId: validGymId,
      title: "New Year Special",
      discountType: "percentage",
      discountValue: 20,
      maxDiscountAmount: 500,
      applicablePlanIds: [],
      targetAudience: "all",
      usageLimit: 50,
      validUntil: "2026-12-31",
      isActive: true,
    };

    const parsed = createOfferSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("validates valid flat discount offer creation", () => {
    const input = {
      gymId: validGymId,
      title: "Referral Discount",
      discountType: "flat",
      discountValue: 200,
      maxDiscountAmount: null,
      applicablePlanIds: [],
      targetAudience: "new_members",
      usageLimit: null,
      validUntil: null,
      isActive: true,
    };

    const parsed = createOfferSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid discount percentage (> 100 or <= 0)", () => {
    const inputZero = {
      gymId: validGymId,
      title: "Zero Discount",
      discountType: "percentage",
      discountValue: 0,
    };
    expect(createOfferSchema.safeParse(inputZero).success).toBe(false);
  });

  it("calculates percentage discount accurately without cap", () => {
    const offer: OfferItem = {
      id: "offer_1",
      gymId: validGymId,
      title: "Summer 20%",
      discountType: "percentage",
      discountValue: 20,
      maxDiscountAmount: null,
      applicablePlanIds: [],
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const result = calculateOfferDiscount(1500, offer);
    expect(result.discountAmount).toBe(300);
    expect(result.finalPrice).toBe(1200);
    expect(result.label).toBe("Summer 20% -20%");
  });

  it("calculates percentage discount with max cap correctly", () => {
    const offer: OfferItem = {
      id: "offer_2",
      gymId: validGymId,
      title: "New Year Special",
      discountType: "percentage",
      discountValue: 20,
      maxDiscountAmount: 500,
      applicablePlanIds: [],
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // 20% of 8,000 = 1,600, capped at 500
    const result = calculateOfferDiscount(8000, offer);
    expect(result.discountAmount).toBe(500);
    expect(result.finalPrice).toBe(7500);
  });

  it("calculates flat discount correctly", () => {
    const offer: OfferItem = {
      id: "offer_3",
      gymId: validGymId,
      title: "Referral Discount",
      discountType: "flat",
      discountValue: 200,
      maxDiscountAmount: null,
      applicablePlanIds: [],
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const result = calculateOfferDiscount(2500, offer);
    expect(result.discountAmount).toBe(200);
    expect(result.finalPrice).toBe(2300);
    expect(result.label).toBe("Referral Discount -₹200");
  });

  it("returns base price when offer is inactive or null", () => {
    const inactiveOffer: OfferItem = {
      id: "offer_4",
      gymId: validGymId,
      title: "Expired",
      discountType: "flat",
      discountValue: 500,
      applicablePlanIds: [],
      usageCount: 0,
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    const result = calculateOfferDiscount(2500, inactiveOffer);
    expect(result.discountAmount).toBe(0);
    expect(result.finalPrice).toBe(2500);
    expect(result.label).toBe("No Offer");
  });
});
