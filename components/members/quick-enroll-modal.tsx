"use client";

import { useState } from "react";
import { UserPlus, X, Loader2, CheckCircle2, MessageSquare, Copy, Check } from "lucide-react";
import { quickEnrollMemberAction } from "@/lib/actions/members";

interface Plan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

interface QuickEnrollModalProps {
  gymId: string;
  branchId: string;
  plans: Plan[];
}

export function QuickEnrollModal({ gymId, branchId, plans }: QuickEnrollModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || "");
  const [amountPaid, setAmountPaid] = useState<string>(
    plans[0]?.price ? plans[0].price.toString() : ""
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [createdWaUrl, setCreatedWaUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handlePlanChange(planId: string) {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setAmountPaid(plan.price.toString());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !phone.trim()) {
      setError("Please provide at least member name and phone number");
      return;
    }

    setLoading(true);
    const res = await quickEnrollMemberAction({
      gymId,
      branchId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || null,
      planId: selectedPlanId || null,
      amountPaid: amountPaid ? parseFloat(amountPaid) : undefined,
      paymentMethod: paymentMethod as "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other",
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to enroll member");
    } else {
      setCreatedInviteUrl(res.inviteUrl || null);
      setCreatedWaUrl(res.waShareUrl || null);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setCreatedInviteUrl(null);
    setCreatedWaUrl(null);
    setFullName("");
    setPhone("");
    setEmail("");
    setNotes("");
  }

  function handleCopy() {
    if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
      >
        <UserPlus className="w-4 h-4" />
        Quick Enroll Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Quick Member Onboarding</h3>
                  <p className="text-xs text-slate-500">
                    Add member, assign plan & generate portal invite in 30 seconds
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="mt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Member Enrolled Successfully!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Send the Member Portal claim link to {fullName}&apos;s smartphone
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 outline-none truncate text-center select-all"
                  />

                  {createdWaUrl && (
                    <a
                      href={createdWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Send Portal Link via WhatsApp
                    </a>
                  )}

                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Link Copied!" : "Copy Portal Claim Link"}
                  </button>

                  <button
                    onClick={handleClose}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Plan Selection */}
                {plans.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assign Membership Plan
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No Plan (Register Member Only)</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₹{p.price} ({p.durationDays} days)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedPlanId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI / QR</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Complete Registration
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
