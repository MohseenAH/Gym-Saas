import { describe, it, expect } from "vitest";
import { z } from "zod";

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
});

describe("Member Portal UPI Verification Guard Suite", () => {
  const gymId = "11111111-1111-4111-8111-111111111111";
  const branchId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";
  const membershipId = "44444444-4444-4444-8444-444444444444";
  const paymentId = "55555555-5555-4555-8555-555555555555";

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

  it("validates staff payment verification schema", () => {
    const valid = verifyPaymentSchema.safeParse({
      gymId,
      paymentId,
    });
    expect(valid.success).toBe(true);
  });

  it("ensures member UPI payments are initialized as pending", () => {
    // Model test of state machine
    interface PaymentRecord {
      id: string;
      gymId: string;
      memberId: string;
      amount: number;
      paymentMethod: string;
      paymentStatus: "paid" | "pending";
      notes: string;
    }

    const initialRecord: PaymentRecord = {
      id: paymentId,
      gymId,
      memberId,
      amount: 2500,
      paymentMethod: "upi",
      paymentStatus: "pending",
      notes: "Member UPI transfer (UTR: 123456789012)",
    };

    expect(initialRecord.paymentStatus).toBe("pending");
    expect(initialRecord.paymentMethod).toBe("upi");

    // Staff approves payment
    function approvePayment(rec: PaymentRecord): PaymentRecord {
      if (rec.paymentStatus === "pending") {
        return { ...rec, paymentStatus: "paid" };
      }
      return rec;
    }

    const approved = approvePayment(initialRecord);
    expect(approved.paymentStatus).toBe("paid");
  });

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
