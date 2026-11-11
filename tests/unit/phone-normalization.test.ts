import { describe, it, expect } from "vitest";
import { normalizeIndianPhone } from "@/lib/utils";

describe("Phase A: Indian Phone Normalization & Validation", () => {
  it("normalizes clean 10-digit Indian mobile numbers", () => {
    const res = normalizeIndianPhone("9876543210");
    expect(res.isValid).toBe(true);
    expect(res.phone).toBe("9876543210");
    expect(res.error).toBeUndefined();
  });

  it("normalizes numbers with valid spaces and hyphens", () => {
    expect(normalizeIndianPhone("98765 43210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("98765-43210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("987-654-3210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("(0) 98765 43210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
  });

  it("normalizes international +91 and 91 prefixes", () => {
    expect(normalizeIndianPhone("+91 9876543210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("+919876543210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("919876543210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("+91-98765-43210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
  });

  it("normalizes trunk prefix with leading zero", () => {
    expect(normalizeIndianPhone("09876543210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
    expect(normalizeIndianPhone("0 98765 43210")).toEqual({
      isValid: true,
      phone: "9876543210",
    });
  });

  it("accepts valid Indian mobile starting digits: 6, 7, 8, 9", () => {
    expect(normalizeIndianPhone("6123456789").isValid).toBe(true);
    expect(normalizeIndianPhone("7123456789").isValid).toBe(true);
    expect(normalizeIndianPhone("8123456789").isValid).toBe(true);
    expect(normalizeIndianPhone("9123456789").isValid).toBe(true);
  });

  it("strictly rejects non-permitted characters (letters, symbols) without silent truncation", () => {
    const res1 = normalizeIndianPhone("98765abc4321");
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("invalid characters");

    const res2 = normalizeIndianPhone("98765@4321");
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("invalid characters");

    const res3 = normalizeIndianPhone("98765#43210");
    expect(res3.isValid).toBe(false);
    expect(res3.error).toContain("invalid characters");
  });

  it("rejects invalid '+' sign placement", () => {
    const res = normalizeIndianPhone("98765+43210");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("'+'");
  });

  it("rejects numbers starting with invalid digits (0-5 after prefix removal)", () => {
    const res1 = normalizeIndianPhone("1234567890");
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("start with 6, 7, 8, or 9");

    const res2 = normalizeIndianPhone("5555555555");
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("start with 6, 7, 8, or 9");

    const res3 = normalizeIndianPhone("+91 2345678901");
    expect(res3.isValid).toBe(false);
    expect(res3.error).toContain("start with 6, 7, 8, or 9");
  });

  it("rejects numbers with incorrect digit counts", () => {
    const resShort = normalizeIndianPhone("987654321");
    expect(resShort.isValid).toBe(false);
    expect(resShort.error).toContain("exactly 10 digits");

    const resLong = normalizeIndianPhone("987654321000");
    expect(resLong.isValid).toBe(false);
    expect(resLong.error).toContain("exactly 10 digits");
  });

  it("rejects empty or non-string inputs", () => {
    expect(normalizeIndianPhone("").isValid).toBe(false);
    expect(normalizeIndianPhone("   ").isValid).toBe(false);
    expect(normalizeIndianPhone(null).isValid).toBe(false);
    expect(normalizeIndianPhone(undefined).isValid).toBe(false);
    expect(normalizeIndianPhone(1234567890).isValid).toBe(false);
  });
});
