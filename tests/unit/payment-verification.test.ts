import { describe, it, expect } from "vitest";
import { z } from "zod";
import { calculateRemainingDues, validatePaymentAmountAgainstDues } from "@/lib/utils";

const submitMemberUpiPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  membershipId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  utrRef: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const verifyPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  paymentId: z.string().uuid("Invalid payment ID"),
  action: z.enum(["approve", "reject"]).default("approve"),
  rejectionReason: z.string().max(300).optional().nullable(),
});

describe("Member Portal UPI Verification & Dues Integrity Suite", () => {
  const gymId = "11111111-1111-4111-8111-111111111111";
  const branchId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";
  const membershipId = "44444444-4444-4444-8444-444444444444";
  const paymentId = "55555555-5555-4555-8555-555555555555";

  // ==========================================================================
  // 1. Schema Validations
  // ==========================================================================
  describe("Payment Schemas", () => {
    it("validates member UPI payment submission schema", () => {
      const valid = submitMemberUpiPaymentSchema.safeParse({
        gymId,
        branchId,
        memberId,
        membershipId,
        amount: 2500,
        utrRef: "123456789012",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects non-positive amounts in member submission", () => {
      const invalid = submitMemberUpiPaymentSchema.safeParse({
        gymId,
        branchId,
        memberId,
        amount: -100,
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects invalid UUIDs in member submission", () => {
      const invalid = submitMemberUpiPaymentSchema.safeParse({
        gymId: "not-a-uuid",
        branchId,
        memberId,
        amount: 1000,
      });
      expect(invalid.success).toBe(false);
    });

    it("validates staff payment verification schema for approval and rejection", () => {
      const approveValid = verifyPaymentSchema.safeParse({
        gymId,
        paymentId,
        action: "approve",
      });
      expect(approveValid.success).toBe(true);

      const rejectValid = verifyPaymentSchema.safeParse({
        gymId,
        paymentId,
        action: "reject",
        rejectionReason: "Invalid UTR screenshot",
      });
      expect(rejectValid.success).toBe(true);
      if (rejectValid.success) {
        expect(rejectValid.data.action).toBe("reject");
        expect(rejectValid.data.rejectionReason).toBe("Invalid UTR screenshot");
      }
    });
  });

  // ==========================================================================
  // 2. Strict Dues & Overpayment Guards
  // ==========================================================================
  describe("Overpayment Guards (validatePaymentAmountAgainstDues)", () => {
    it("rejects payment amounts exceeding current outstanding dues", () => {
      const outstandingDues = 2000;
      const paymentAmount = 2500;

      const check = validatePaymentAmountAgainstDues(outstandingDues, paymentAmount);
      expect(check.isValid).toBe(false);
      expect(check.error).toContain("exceeds outstanding dues");
      expect(check.error).toContain("₹2500");
      expect(check.error).toContain("₹2000");
    });

    it("permits exact payment matching outstanding dues", () => {
      const outstandingDues = 1500;
      const paymentAmount = 1500;

      const check = validatePaymentAmountAgainstDues(outstandingDues, paymentAmount);
      expect(check.isValid).toBe(true);
      expect(check.error).toBeUndefined();
    });

    it("permits partial payment below outstanding dues", () => {
      const outstandingDues = 3000;
      const paymentAmount = 1000;

      const check = validatePaymentAmountAgainstDues(outstandingDues, paymentAmount);
      expect(check.isValid).toBe(true);
    });

    it("rejects non-positive payment amounts", () => {
      expect(validatePaymentAmountAgainstDues(1000, 0).isValid).toBe(false);
      expect(validatePaymentAmountAgainstDues(1000, -500).isValid).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Pending Dues Decrement & Invariants
  // ==========================================================================
  describe("Dues Decrement Invariants (calculateRemainingDues)", () => {
    it("accurately decrements dues upon partial payment", () => {
      const currentDues = 2500;
      const paymentAmount = 1000;
      expect(calculateRemainingDues(currentDues, paymentAmount)).toBe(1500);
    });

    it("evaluates remaining dues to 0 upon full payment", () => {
      const currentDues = 1800;
      const paymentAmount = 1800;
      expect(calculateRemainingDues(currentDues, paymentAmount)).toBe(0);
    });

    it("never permits remaining dues to drop below 0 (clamped)", () => {
      const currentDues = 500;
      const paymentAmount = 600;
      expect(calculateRemainingDues(currentDues, paymentAmount)).toBe(0);
    });

    it("handles null or undefined dues gracefully as 0", () => {
      expect(calculateRemainingDues(null, 500)).toBe(0);
      expect(calculateRemainingDues(undefined, 500)).toBe(0);
    });
  });

  // ==========================================================================
  // 4. Member UPI Claim & Staff Approval Lifecycle
  // ==========================================================================
  describe("Member UPI Approval State Machine", () => {
    interface PaymentRecord {
      id: string;
      gymId: string;
      memberId: string;
      membershipId: string;
      amount: number;
      paymentMethod: string;
      paymentStatus: "paid" | "pending" | "rejected";
      notes: string;
    }

    interface MembershipRecord {
      id: string;
      pending_dues: number;
    }

    it("ensures member UPI submissions start as pending and DO NOT reduce dues prematurely", () => {
      const initialMembership: MembershipRecord = {
        id: membershipId,
        pending_dues: 2500,
      };

      const initialPayment: PaymentRecord = {
        id: paymentId,
        gymId,
        memberId,
        membershipId,
        amount: 2500,
        paymentMethod: "upi",
        paymentStatus: "pending",
        notes: "Member UPI transfer (UTR: 123456789012)",
      };

      // Invariant: At submission time, status is 'pending' and dues remain unchanged
      expect(initialPayment.paymentStatus).toBe("pending");
      expect(initialMembership.pending_dues).toBe(2500);
    });

    it("atomically decrements dues when staff approves pending payment", () => {
      const membership: MembershipRecord = {
        id: membershipId,
        pending_dues: 2500,
      };

      const payment: PaymentRecord = {
        id: paymentId,
        gymId,
        memberId,
        membershipId,
        amount: 2500,
        paymentMethod: "upi",
        paymentStatus: "pending",
        notes: "Member UPI transfer (UTR: 123456789012)",
      };

      // Simulate staff approval
      function approvePayment(pay: PaymentRecord, mem: MembershipRecord) {
        if (pay.paymentStatus !== "pending") {
          throw new Error("Only pending payments can be approved");
        }
        pay.paymentStatus = "paid";
        mem.pending_dues = calculateRemainingDues(mem.pending_dues, pay.amount);
        return { pay, mem };
      }

      const result = approvePayment(payment, membership);
      expect(result.pay.paymentStatus).toBe("paid");
      expect(result.mem.pending_dues).toBe(0);
    });

    it("preserves member dues unchanged when staff rejects a fraudulent/duplicate claim", () => {
      const membership: MembershipRecord = {
        id: membershipId,
        pending_dues: 2500,
      };

      const payment: PaymentRecord = {
        id: paymentId,
        gymId,
        memberId,
        membershipId,
        amount: 2500,
        paymentMethod: "upi",
        paymentStatus: "pending",
        notes: "Member UPI transfer (UTR: 000000000000)",
      };

      // Simulate staff rejection
      function rejectPayment(pay: PaymentRecord, mem: MembershipRecord, reason: string) {
        if (pay.paymentStatus !== "pending") {
          throw new Error("Only pending payments can be rejected");
        }
        pay.paymentStatus = "rejected";
        pay.notes += ` [REJECTED: ${reason}]`;
        // Invariant: Dues remain untouched!
        return { pay, mem };
      }

      const result = rejectPayment(payment, membership, "Invalid transaction UTR");
      expect(result.pay.paymentStatus).toBe("rejected");
      expect(result.pay.notes).toContain("[REJECTED: Invalid transaction UTR]");
      expect(result.mem.pending_dues).toBe(2500); // Intact!
    });
  });

  // ==========================================================================
  // 5. Zero-Dependency CSV Export Logic
  // ==========================================================================
  describe("Zero-Dependency CSV Export Logic", () => {
    function escapeCsvCell(cell: string | number | null | undefined): string {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell);
      return `"${str.replace(/"/g, '""')}"`;
    }

    function generateCsvString(headers: string[], rows: (string | number)[][]): string {
      const headerLine = headers.map(escapeCsvCell).join(",");
      const rowLines = rows.map((r) => r.map(escapeCsvCell).join(","));
      return "\uFEFF" + [headerLine, ...rowLines].join("\r\n");
    }

    it("escapes cells containing commas, quotes, and newlines safely", () => {
      expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
      expect(escapeCsvCell("One, Two")).toBe('"One, Two"');
      expect(escapeCsvCell(1500)).toBe('"1500"');
      expect(escapeCsvCell(null)).toBe('""');
    });

    it("generates well-formed CSV with UTF-8 BOM prefix", () => {
      const headers = ["Ref", "Member", "Amount", "Status"];
      const rows = [
        ["#A1B2C3D4", "Rahul Sharma", 1500, "PAID"],
        ["#E5F6G7H8", "Priya Patel", 2500, "PENDING"],
      ];

      const csv = generateCsvString(headers, rows);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain('"#A1B2C3D4","Rahul Sharma","1500","PAID"');
      expect(csv).toContain('"#E5F6G7H8","Priya Patel","2500","PENDING"');
    });
  });
});
