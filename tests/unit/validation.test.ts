import { describe, it, expect } from "vitest";
import { z } from "zod";

// Formal validation schemas matching application specifications
const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  gymName: z.string().trim().min(2, "Gym name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  phone: z.string().trim().min(8, "Phone number must be at least 8 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  phone: z.string().trim().min(8, "Phone number must be at least 8 digits"),
  gymName: z.string().trim().min(2, "Gym / Business name must be at least 2 characters"),
  branchName: z.string().trim().default("Main Branch"),
});

describe("Phase 1 Validation & Sanitization Unit Tests", () => {
  it("TEST-P1-010: Valid signup payload parses cleanly", () => {
    const validData = {
      fullName: "Mohseen Khan",
      gymName: "Apex Iron Club",
      email: "mohseen@gymapra.com",
      phone: "+919876543210",
      password: "StrongPassword123!",
    };
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("mohseen@gymapra.com");
      expect(result.data.fullName).toBe("Mohseen Khan");
    }
  });

  it("TEST-P1-012: Invalid email formats are strictly rejected", () => {
    const invalidEmails = ["owner@", "owner", "owner@domain", "owner@.com", "@domain.com"];
    for (const badEmail of invalidEmails) {
      const result = signupSchema.safeParse({
        fullName: "Test Owner",
        gymName: "Test Gym",
        email: badEmail,
        phone: "9876543210",
        password: "ValidPassword123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("email");
      }
    }
  });

  it("TEST-P1-013: Weak password (< 6 chars) is rejected", () => {
    const weakPasswords = ["123", "abc", "pass", "12345"];
    for (const weak of weakPasswords) {
      const result = signupSchema.safeParse({
        fullName: "Test Owner",
        gymName: "Test Gym",
        email: "owner@test.com",
        phone: "9876543210",
        password: weak,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 6 characters");
      }
    }
  });

  it("TEST-P1-014: Whitespace around fields is automatically normalized", () => {
    const padded = {
      fullName: "   Rahul Sharma   ",
      gymName: "   Iron Gym   ",
      email: "   RAHUL@TEST.COM   ",
      phone: "   9876543210   ",
      password: "ValidPassword123",
    };
    const result = signupSchema.safeParse(padded);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Rahul Sharma");
      expect(result.data.gymName).toBe("Iron Gym");
      expect(result.data.email).toBe("rahul@test.com");
      expect(result.data.phone).toBe("9876543210");
    }
  });

  it("TEST-P1-015: Email case variations are normalized to lowercase", () => {
    const variations = ["Owner@Test.com", "OWNER@TEST.COM", "oWnEr@TeSt.CoM"];
    for (const email of variations) {
      const result = signupSchema.safeParse({
        fullName: "Owner",
        gymName: "Gym",
        email,
        phone: "9876543210",
        password: "ValidPassword123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("owner@test.com");
      }
    }
  });

  it("TEST-P1-042: Unicode, Devanagari and Indian business names are supported", () => {
    const unicodePayload = {
      fullName: "सचिन तेंडुलकर",
      phone: "+919876543210",
      gymName: "मराठी Fitness क्लब & 24/7 Gym",
      branchName: "शाखा १ - मेन रोड",
    };
    const result = onboardingSchema.safeParse(unicodePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gymName).toBe("मराठी Fitness क्लब & 24/7 Gym");
      expect(result.data.branchName).toBe("शाखा १ - मेन रोड");
    }
  });
});
