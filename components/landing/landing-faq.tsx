"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_LEFT: FaqItem[] = [
  {
    id: "faq-1",
    question: "What is the free trial?",
    answer:
      "You receive 14 days of full access to all GymApra features—no credit card required. Add members, create membership plans, track daily attendance, record payments, and explore reporting completely free.",
  },
  {
    id: "faq-2",
    question: "How do I set up my gym?",
    answer:
      "Setup takes under two minutes. Enter your gym name, add your membership plans (Monthly, Quarterly, Annual, etc.), and you're ready to start enrolling members and logging check-ins right away.",
  },
  {
    id: "faq-3",
    question: "Can I add staff members to my gym?",
    answer:
      "Yes. Invite managers, front-desk staff, and trainers with built-in role permissions. Staff can handle check-ins and reception tasks without accessing owner-only settings or financial reports.",
  },
];

const FAQ_RIGHT: FaqItem[] = [
  {
    id: "faq-4",
    question: "Can I manage multiple branches or gyms?",
    answer:
      "Yes. GymApra has native multi-branch support. Switch between branches with one click from the top bar, assign staff to specific locations, and review branch-level or combined gym insights.",
  },
  {
    id: "faq-5",
    question: "What happens after the trial ends?",
    answer:
      "At the end of your 14-day trial, choose a subscription plan to continue. All your members, attendance logs, plans, and payment records are preserved completely intact.",
  },
  {
    id: "faq-6",
    question: "Do my members need a separate account?",
    answer:
      "No separate account is required. Gym staff manage everything from the front-desk workspace. Optionally, members can log into the lightweight Member Portal via their phone number to view their own attendance and dues.",
  },
];

function FaqColumn({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={`rounded-xl border bg-white transition-all duration-200 ${
              isOpen
                ? "border-[#2563EB]/30 shadow-sm"
                : "border-[#C8DCF0] hover:border-[#A8C8E8]"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              aria-controls={`answer-${item.id}`}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-xl"
            >
              <span className="font-semibold text-sm text-[#10243E] leading-snug">
                {item.question}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#2563EB] shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              id={`answer-${item.id}`}
              role="region"
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 pt-0 text-sm text-[#10243E]/70 leading-relaxed border-t border-[#E8F0F9] mt-0 pt-3">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LandingFaq() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-10">
      <FaqColumn items={FAQ_LEFT} />
      <FaqColumn items={FAQ_RIGHT} />
    </div>
  );
}
