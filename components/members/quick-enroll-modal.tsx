"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, CheckCircle2, MessageSquare, Copy, Check, IndianRupee } from "lucide-react";
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
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || "");
  const [discount, setDiscount] = useState<string>("");
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

    try {
      const parsedDiscount = parseFloat(discount) || 0;
      const res = await quickEnrollMemberAction({
        gymId,
        branchId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || null,
        planId: selectedPlanId || null,
        amountPaid: amountPaid !== "" && !isNaN(parseFloat(amountPaid)) ? parseFloat(amountPaid) : undefined,
        discount: parsedDiscount > 0 ? parsedDiscount : 0,
        paymentMethod: paymentMethod as "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other",
      });

      if (!res.success) {
        setError(res.error || "Failed to enroll member");
      } else {
        setCreatedInviteUrl(res.inviteUrl || null);
        setCreatedWaUrl(res.waShareUrl || null);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to enroll member");
    } finally {
      setLoading(false);
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
    setDiscount("");
    router.refresh();
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
        className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 py-2 bg-primary hover:opacity-95 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer w-full sm:w-auto"
      >
        <UserPlus className="w-4 h-4" />
        Quick Enroll Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Quick Member Onboarding</h3>
                  <p className="text-xs text-muted-foreground">
                    Add member, assign plan & generate portal invite in 30s
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="mt-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-foreground">Member Enrolled Successfully!</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send the Member Portal claim link to {fullName}&apos;s phone
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="w-full h-11 px-3 bg-muted/50 border border-input rounded-xl text-xs font-mono text-foreground outline-hidden truncate text-center select-all"
                  />

                  {createdWaUrl && (
                    <a
                      href={createdWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-12 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-[0.99]"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Send Portal Link via WhatsApp
                    </a>
                  )}

                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 w-full h-11 px-4 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Link Copied!" : "Copy Portal Claim Link"}
                  </button>

                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                  />
                </div>

                {/* Plan Selection */}
                {plans.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Assign Membership Plan
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all font-semibold cursor-pointer"
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

                {selectedPlanId && (() => {
                  const plan = plans.find((p) => p.id === selectedPlanId);
                  const planPrice = plan ? plan.price : 0;
                  const currentDiscount = parseFloat(discount) || 0;
                  const currentPaid = parseFloat(amountPaid) || 0;
                  const effectiveTotal = Math.max(0, planPrice - currentDiscount);
                  const balanceDue = Math.max(0, effectiveTotal - currentPaid);

                  return (
                    <div className="space-y-3.5 pt-1">
                      {/* Segmented Payment Method Selector */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Payment Mode
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {(["cash", "upi", "card", "pay_later"] as const).map((method) => {
                            const isPayLater = method === "pay_later";
                            const isSelected = isPayLater
                              ? currentPaid === 0
                              : paymentMethod === method && currentPaid > 0;
                            return (
                              <button
                                key={method}
                                type="button"
                                onClick={() => {
                                  if (isPayLater) {
                                    setAmountPaid("0");
                                  } else {
                                    setPaymentMethod(method);
                                    if (currentPaid === 0) {
                                      setAmountPaid(String(effectiveTotal));
                                    }
                                  }
                                }}
                                className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary/10 border-primary text-primary shadow-2xs"
                                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              >
                                {method === "pay_later" ? "Pay Later" : method.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Currency Input (Large Bold) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Amount Paid Now (₹)
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            Plan Price: ₹{planPrice}
                          </span>
                        </div>
                        <div className="relative">
                          <IndianRupee className="w-5 h-5 absolute left-3.5 top-3.5 text-muted-foreground" />
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="w-full h-12 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-2xl font-bold tracking-tight text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Discount (₹)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            className="w-full h-11 px-3 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Net Total (₹)
                          </label>
                          <div className="h-11 px-3.5 bg-muted/60 border border-border rounded-xl flex items-center text-sm font-bold text-foreground">
                            ₹{effectiveTotal.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Balance Due Banner */}
                      {currentPaid >= effectiveTotal && effectiveTotal > 0 ? (
                        <div className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Full payment of ₹{currentPaid.toLocaleString("en-IN")} recorded. Zero balance due.</span>
                        </div>
                      ) : currentPaid > 0 && currentPaid < effectiveTotal ? (
                        <div className="text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                          <IndianRupee className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Partial payment of ₹{currentPaid.toLocaleString("en-IN")} recorded. Balance due: ₹{balanceDue.toLocaleString("en-IN")}</span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
                          <IndianRupee className="w-4 h-4 text-primary shrink-0" />
                          <span>Pay Later: Plan assigned. Full ₹{effectiveTotal.toLocaleString("en-IN")} recorded as pending dues.</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-11 px-4 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 h-11 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
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
