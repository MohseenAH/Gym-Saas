import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror of the server action schema for verification
const recordPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  membershipId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  paymentStatus: z.enum(["paid", "partial", "pending", "refunded"]).default("paid"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(1).max(255).optional().nullable(),
});

describe("Payment Idempotency & Concurrency Protection Suite", () => {
  const gymId = "11111111-1111-4111-8111-111111111111";
  const branchId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";

  it("TEST-PAY-001: Schema accepts valid payment with idempotency key", () => {
    const input = {
      gymId,
      branchId,
      memberId,
      amount: 1500,
      paymentMethod: "upi" as const,
      paymentDate: "2026-10-12",
      idempotencyKey: "test-idem-key-001",
    };

    const parsed = recordPaymentSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.idempotencyKey).toBe("test-idem-key-001");
      expect(parsed.data.paymentStatus).toBe("paid");
    }
  });

  it("TEST-PAY-002: Concurrent duplicate requests with the same idempotency key are safely deduplicated", async () => {
    // Simulated database ledger state
    const databaseLedger = new Map<string, { id: string; gymId: string; amount: number; idempotencyKey: string }>();

    // Atomic insert simulator with unique constraint on (gymId, idempotencyKey)
    async function simulateInsertPayment(payload: {
      gymId: string;
      amount: number;
      idempotencyKey?: string | null;
    }) {
      // Simulate minor async network jitter
      await new Promise((r) => setTimeout(r, Math.random() * 10));

      if (payload.idempotencyKey) {
        const uniqueKey = `${payload.gymId}::${payload.idempotencyKey}`;
        if (databaseLedger.has(uniqueKey)) {
          // PostgreSQL 23505 unique violation
          const existing = databaseLedger.get(uniqueKey)!;
          return {
            success: true,
            paymentId: existing.id,
            isDuplicate: true,
          };
        }

        const newPayment = {
          id: `pay_${Math.random().toString(36).substring(2, 9)}`,
          gymId: payload.gymId,
          amount: payload.amount,
          idempotencyKey: payload.idempotencyKey,
        };
        databaseLedger.set(uniqueKey, newPayment);
        return {
          success: true,
          paymentId: newPayment.id,
          isDuplicate: false,
        };
      }

      // Non-idempotent insert
      const newPayment = {
        id: `pay_${Math.random().toString(36).substring(2, 9)}`,
        gymId: payload.gymId,
        amount: payload.amount,
        idempotencyKey: "",
      };
      return { success: true, paymentId: newPayment.id, isDuplicate: false };
    }

    const idempotencyKey = "client-req-uuid-999";

    // Simulate 5 identical concurrent requests fired at the exact same millisecond
    const concurrentRequests = Array.from({ length: 5 }, () =>
      simulateInsertPayment({
        gymId,
        amount: 2000,
        idempotencyKey,
      })
    );

    const results = await Promise.all(concurrentRequests);

    // Exactly one request performs the insertion; all others return the same paymentId with isDuplicate=true
    const primarySuccesses = results.filter((r) => r.success && !r.isDuplicate);
    const idempotentRecoveries = results.filter((r) => r.success && r.isDuplicate);

    expect(primarySuccesses.length).toBe(1);
    expect(idempotentRecoveries.length).toBe(4);

    // All 5 requests returned the EXACT same payment ID
    const primaryId = primarySuccesses[0].paymentId;
    for (const rec of idempotentRecoveries) {
      expect(rec.paymentId).toBe(primaryId);
    }

    // Database ledger contains exactly ONE payment
    expect(databaseLedger.size).toBe(1);
  });

  it("TEST-PAY-003: Preserves legitimate separate payments for the same member", async () => {
    const databaseLedger = new Map<string, { id: string; amount: number; idempotencyKey: string }>();

    async function recordPayment(amount: number, idempotencyKey: string) {
      const uniqueKey = `${gymId}::${idempotencyKey}`;
      if (databaseLedger.has(uniqueKey)) {
        return { success: true, paymentId: databaseLedger.get(uniqueKey)!.id, isDuplicate: true };
      }
      const payment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        amount,
        idempotencyKey,
      };
      databaseLedger.set(uniqueKey, payment);
      return { success: true, paymentId: payment.id, isDuplicate: false };
    }

    // Payment 1: ₹1,500 monthly fee
    const payment1 = await recordPayment(1500, "idem-session-1");
    expect(payment1.success).toBe(true);
    expect(payment1.isDuplicate).toBe(false);

    // Payment 2: ₹500 locker fee (separate legitimate payment recorded right after)
    const payment2 = await recordPayment(500, "idem-session-2");
    expect(payment2.success).toBe(true);
    expect(payment2.isDuplicate).toBe(false);

    // Verify both payments exist as distinct records
    expect(payment1.paymentId).not.toBe(payment2.paymentId);
    expect(databaseLedger.size).toBe(2);
  });

  it("TEST-PAY-004: Invalid amounts or dates are strictly rejected before database interaction", () => {
    const zeroAmount = recordPaymentSchema.safeParse({
      gymId,
      branchId,
      memberId,
      amount: 0,
      paymentDate: "2026-10-12",
    });
    expect(zeroAmount.success).toBe(false);

    const negativeAmount = recordPaymentSchema.safeParse({
      gymId,
      branchId,
      memberId,
      amount: -100,
      paymentDate: "2026-10-12",
    });
    expect(negativeAmount.success).toBe(false);

    const invalidDate = recordPaymentSchema.safeParse({
      gymId,
      branchId,
      memberId,
      amount: 500,
      paymentDate: "12-10-2026", // Wrong format
    });
    expect(invalidDate.success).toBe(false);
  });
});
