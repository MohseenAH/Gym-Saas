import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCsv, normalizeIndianPhone } from "@/lib/utils";
import {
  previewBulkImportMembersAction,
  bulkImportMembersAction,
  RowToImport,
} from "@/lib/actions/members";

// Mocks for server action dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  getAuthorizedActionContext: vi.fn().mockImplementation(async ({ gymId, targetBranchId }) => ({
    userId: "user-123",
    gymId,
    gymName: "Alpha Fitness",
    branchId: targetBranchId,
    role: "owner",
    membershipCount: 10,
    planCount: 3,
  })),
}));

// Mutable mock state for Supabase
let mockExistingMembers: Array<{
  id: string;
  full_name: string;
  phone: string;
  branch_id: string;
  branches: { id: string; name: string; gym_id: string };
}> = [];

let mockInsertCalls: any[] = [];
let mockInsertError: { message: string; code?: string } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: (table: string) => {
      if (table === "members") {
        return {
          select: (cols: string) => ({
            eq: (col: string, val: any) => ({
              in: (inCol: string, inVals: string[]) => {
                const filtered = mockExistingMembers.filter((m) =>
                  inVals.includes(m.phone)
                );
                return Promise.resolve({ data: filtered, error: null });
              },
            }),
          }),
          insert: (rows: any) => {
            mockInsertCalls.push(rows);
            if (mockInsertError) {
              return Promise.resolve({ error: mockInsertError });
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      };
    },
  })),
}));

describe("Phase A: Standalone Member Bulk Import & Normalization Suite", () => {
  const gymId = "11111111-1111-4111-8111-111111111111";
  const branchId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingMembers = [];
    mockInsertCalls = [];
    mockInsertError = null;
  });

  // ==========================================================================
  // 1. RFC 4180 CSV Parser Tests
  // ==========================================================================
  describe("CSV Parsing (parseCsv)", () => {
    it("parses standard CSV with header and data rows", () => {
      const csv = `Full Name,Phone,Email,Notes\nRahul Sharma,9876543210,rahul@example.com,Morning Batch\nPriya Patel,9876543211,priya@example.com,Evening`;
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        "Full Name": "Rahul Sharma",
        Phone: "9876543210",
        Email: "rahul@example.com",
        Notes: "Morning Batch",
      });
      expect(rows[1]["Full Name"]).toBe("Priya Patel");
    });

    it("handles quoted fields containing commas", () => {
      const csv = `Full Name,Phone,Notes\n"Sharma, Rahul",9876543210,"Locker 4, morning"`;
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]["Full Name"]).toBe("Sharma, Rahul");
      expect(rows[0]["Notes"]).toBe("Locker 4, morning");
    });

    it("handles escaped double-quotes in quoted fields", () => {
      const csv = `Full Name,Phone,Notes\n"Amit ""The Beast"" Verma",9876543210,"VIP Member"`;
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]["Full Name"]).toBe('Amit "The Beast" Verma');
    });

    it("handles Windows CRLF line breaks and trailing newlines", () => {
      const csv = "Full Name,Phone\r\nVikram Singh,9876543210\r\nAnanya Sen,9876543211\r\n";
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0]["Full Name"]).toBe("Vikram Singh");
      expect(rows[1]["Full Name"]).toBe("Ananya Sen");
    });

    it("returns empty array for empty string, blank lines, or header-only file", () => {
      expect(parseCsv("")).toEqual([]);
      expect(parseCsv("   \n\r\n  ")).toEqual([]);
      expect(parseCsv("Full Name,Phone,Email")).toEqual([]);
    });

    it("handles missing values in row gracefully by populating empty string", () => {
      const csv = `Full Name,Phone,Email,Notes\nRahul Sharma,9876543210`;
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]["Full Name"]).toBe("Rahul Sharma");
      expect(rows[0]["Phone"]).toBe("9876543210");
      expect(rows[0]["Email"]).toBe("");
      expect(rows[0]["Notes"]).toBe("");
    });
  });

  // ==========================================================================
  // 2. previewBulkImportMembersAction Tests
  // ==========================================================================
  describe("Import Preview Validation & Categorization", () => {
    it("categorizes fully valid rows as VALID", async () => {
      const rawRows = [
        {
          "Full Name": "Rahul Sharma",
          Phone: "+91 98765 43210",
          Email: "rahul@example.com",
          Notes: "Strength athlete",
        },
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.validCount).toBe(1);
      expect(res.summary.alreadyExistsCount).toBe(0);
      expect(res.summary.invalidCount).toBe(0);
      expect(res.rows[0].status).toBe("VALID");
      expect(res.rows[0].parsed.fullName).toBe("Rahul Sharma");
      expect(res.rows[0].parsed.phone).toBe("9876543210");
      expect(res.rows[0].parsed.email).toBe("rahul@example.com");
      expect(res.canProceed).toBe(true);
    });

    it("rejects rows with invalid names (< 2 chars or > 100 chars)", async () => {
      const rawRows = [
        { "Full Name": "A", Phone: "9876543210" },
        { "Full Name": "X".repeat(101), Phone: "9876543211" },
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.validCount).toBe(0);
      expect(res.summary.invalidCount).toBe(2);
      expect(res.rows[0].status).toBe("INVALID");
      expect(res.rows[0].reasons).toContain("Full Name must be at least 2 characters");
      expect(res.rows[1].status).toBe("INVALID");
      expect(res.rows[1].reasons).toContain("Full Name cannot exceed 100 characters");
      expect(res.canProceed).toBe(false);
    });

    it("rejects rows with invalid emails while allowing empty or omitted emails", async () => {
      const rawRows = [
        { "Full Name": "Valid User", Phone: "9876543210", Email: "not-an-email" },
        { "Full Name": "Another User", Phone: "9876543211", Email: "" },
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.rows[0].status).toBe("INVALID");
      expect(res.rows[0].reasons).toContain("Invalid email address format");
      expect(res.rows[1].status).toBe("VALID");
      expect(res.rows[1].parsed.email).toBeNull();
    });

    it("rejects rows with invalid phones and explains the exact issue", async () => {
      const rawRows = [
        { "Full Name": "Bad Phone", Phone: "1234567890" }, // starts with 1
        { "Full Name": "Alphanumeric", Phone: "98765abcde" }, // letters
        { "Full Name": "Short Phone", Phone: "98765" }, // short
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.invalidCount).toBe(3);
      expect(res.rows[0].reasons[0]).toContain("Indian mobile numbers must start with 6, 7, 8, or 9");
      expect(res.rows[1].reasons[0]).toContain("invalid characters");
      expect(res.rows[2].reasons[0]).toContain("must be exactly 10 digits");
    });

    it("flags intra-file duplicate phone numbers across rows with previous row reference", async () => {
      const rawRows = [
        { "Full Name": "First Entry", Phone: "9876543210" },
        { "Full Name": "Second Entry (Duplicate)", Phone: "+91 98765 43210" }, // same normalized phone
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.validCount).toBe(1);
      expect(res.summary.invalidCount).toBe(1);
      expect(res.rows[0].status).toBe("VALID");
      expect(res.rows[1].status).toBe("INVALID");
      expect(res.rows[1].reasons[0]).toContain(
        "Duplicate phone number within this import file (matches row 1)"
      );
    });

    it("identifies ALREADY_EXISTS when phone is already in database for this gym", async () => {
      mockExistingMembers = [
        {
          id: "mem-1",
          full_name: "Karan Johar",
          phone: "9876543210",
          branch_id: branchId,
          branches: { id: branchId, name: "Downtown Branch", gym_id: gymId },
        },
      ];

      const rawRows = [
        { "Full Name": "Karan New", Phone: "9876543210" },
        { "Full Name": "Brand New Member", Phone: "9876543219" },
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.totalRows).toBe(2);
      expect(res.summary.alreadyExistsCount).toBe(1);
      expect(res.summary.validCount).toBe(1);
      expect(res.summary.invalidCount).toBe(0);

      expect(res.rows[0].status).toBe("ALREADY_EXISTS");
      expect(res.rows[0].reasons[0]).toContain("Phone already registered to Karan Johar");
      expect(res.rows[1].status).toBe("VALID");
      expect(res.canProceed).toBe(true);
    });

    it("supports various column header variations (Name, Mobile, Contact, notes)", async () => {
      const rawRows = [
        { Name: "Sita Raman", Mobile: "9876543210", email: "sita@example.com", note: "VIP" },
      ];

      const res = await previewBulkImportMembersAction(gymId, branchId, rawRows);
      expect(res.success).toBe(true);
      expect(res.summary.validCount).toBe(1);
      expect(res.rows[0].parsed.fullName).toBe("Sita Raman");
      expect(res.rows[0].parsed.phone).toBe("9876543210");
      expect(res.rows[0].parsed.notes).toBe("VIP");
    });
  });

  // ==========================================================================
  // 3. bulkImportMembersAction & Standalone Invariant Tests
  // ==========================================================================
  describe("Batch Member Import Execution & Standalone Invariants", () => {
    it("strictly inserts into 'members' table ONLY with zero membership or payment fields", async () => {
      const rowsToImport: RowToImport[] = [
        { fullName: "Rohit Sharma", phone: "9876543210", email: "rohit@example.com", notes: "Batting Coach" },
        { fullName: "Hardik Pandya", phone: "9876543211", email: null, notes: null },
      ];

      const res = await bulkImportMembersAction(gymId, branchId, rowsToImport);
      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(2);
      expect(res.skippedCount).toBe(0);
      expect(res.failedCount).toBe(0);

      // Verify what was inserted
      expect(mockInsertCalls).toHaveLength(1);
      const insertedRows = mockInsertCalls[0];
      expect(insertedRows).toHaveLength(2);

      for (const row of insertedRows) {
        // Assert mandatory member fields
        expect(row.gym_id).toBe(gymId);
        expect(row.branch_id).toBe(branchId);
        expect(row.status).toBe("active");
        expect(typeof row.full_name).toBe("string");
        expect(typeof row.phone).toBe("string");

        // STANDALONE INVARIANT: Must NOT contain membership contract or payment fields
        expect((row as any).plan_id).toBeUndefined();
        expect((row as any).membership_id).toBeUndefined();
        expect((row as any).amount_paid).toBeUndefined();
        expect((row as any).amount).toBeUndefined();
        expect((row as any).payment_method).toBeUndefined();
        expect((row as any).start_date).toBeUndefined();
        expect((row as any).end_date).toBeUndefined();
        expect((row as any).pending_dues).toBeUndefined();
      }
    });

    it("performs zero-trust re-validation and skips malformed or duplicate phones on server", async () => {
      const rowsToImport: RowToImport[] = [
        { fullName: "Valid One", phone: "9876543210" },
        { fullName: "Duplicate Phone", phone: "9876543210" }, // duplicate
        { fullName: "Invalid Phone", phone: "12345" }, // invalid
        { fullName: "A", phone: "9876543212" }, // name too short
      ];

      const res = await bulkImportMembersAction(gymId, branchId, rowsToImport);
      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(1);
      expect(res.skippedCount).toBe(3);
    });

    it("re-queries database before insert to eliminate concurrent duplicate collisions", async () => {
      // Suppose during the user preview, phone 9876543210 was registered by another staff member
      mockExistingMembers = [
        {
          id: "mem-collision",
          full_name: "Concurrent Member",
          phone: "9876543210",
          branch_id: branchId,
          branches: { id: branchId, name: "Downtown Branch", gym_id: gymId },
        },
      ];

      const rowsToImport: RowToImport[] = [
        { fullName: "Colliding Member", phone: "9876543210" },
        { fullName: "Safe Member", phone: "9876543215" },
      ];

      const res = await bulkImportMembersAction(gymId, branchId, rowsToImport);
      expect(res.success).toBe(true);
      expect(res.importedCount).toBe(1); // Only Safe Member inserted
      expect(res.skippedCount).toBe(1); // Colliding Member skipped safely

      expect(mockInsertCalls[0]).toHaveLength(1);
      expect(mockInsertCalls[0][0].phone).toBe("9876543215");
    });

    it("rejects batch import if payload exceeds 500 rows", async () => {
      const largeBatch: RowToImport[] = Array.from({ length: 501 }, (_, i) => ({
        fullName: `User ${i}`,
        phone: `98765${String(i).padStart(5, "0")}`,
      }));

      const res = await bulkImportMembersAction(gymId, branchId, largeBatch);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot import more than 500 rows at once");
      expect(mockInsertCalls).toHaveLength(0);
    });

    it("rejects batch import if gymId or branchId is missing", async () => {
      const res = await bulkImportMembersAction("", branchId, [
        { fullName: "Test", phone: "9876543210" },
      ]);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Gym ID and Branch ID are required");
    });

    it("rejects batch import if rowsToImport is empty", async () => {
      const res = await bulkImportMembersAction(gymId, branchId, []);
      expect(res.success).toBe(false);
      expect(res.error).toContain("No rows provided for import");
    });
  });
});
