import { describe, it, expect } from "vitest";
import { COMPANY_CONTACT } from "@/lib/config/company";
import { normalizeIndianPhone } from "@/lib/utils";

describe("Official GymApra Company Contact Standardization", () => {
  it("matches the official company contact numbers and link formats", () => {
    expect(COMPANY_CONTACT.name).toBe("GymApra");
    expect(COMPANY_CONTACT.phone).toBe("+91 91564 13365");
    expect(COMPANY_CONTACT.phoneInternational).toBe("+919156413365");
    expect(COMPANY_CONTACT.callUrl).toBe("tel:+919156413365");
    expect(COMPANY_CONTACT.whatsappUrl).toBe("https://wa.me/919156413365");
    expect(COMPANY_CONTACT.email).toBe("support@gymapra.com");
    expect(COMPANY_CONTACT.emailUrl).toBe("mailto:support@gymapra.com");
  });

  it("passes standard Indian phone normalization", () => {
    const normalized = normalizeIndianPhone(COMPANY_CONTACT.phone);
    expect(normalized.isValid).toBe(true);
    expect(normalized.phone).toBe("9156413365");
  });

  it("call link format matches tel: prefix with international number", () => {
    expect(COMPANY_CONTACT.callUrl).toBe(`tel:${COMPANY_CONTACT.phoneInternational}`);
  });

  it("whatsapp link matches wa.me with international digits", () => {
    const digitsOnly = COMPANY_CONTACT.phoneInternational.replace("+", "");
    expect(COMPANY_CONTACT.whatsappUrl).toBe(`https://wa.me/${digitsOnly}`);
  });
});
