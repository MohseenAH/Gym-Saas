/**
 * Official GymApra Company Contact Configuration
 *
 * Centralized contact information for sales, customer support, and general inquiries.
 * Reused across landing pages, footers, support sections, metadata, and communications.
 */

export const COMPANY_CONTACT = {
  name: "GymApra",
  phone: "+91 91564 13365",
  phoneInternational: "+919156413365",
  callUrl: "tel:+919156413365",
  whatsappUrl: "https://wa.me/919156413365",
  email: "support@gymapra.com",
  emailUrl: "mailto:support@gymapra.com",
} as const;

export type CompanyContact = typeof COMPANY_CONTACT;
