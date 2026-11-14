import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import {
  CheckCircle2,
  Circle,
  Compass,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Users,
  IdCard,
  Building2,
  CalendarCheck,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface GettingStartedPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function GettingStartedPage({
  params,
  searchParams,
}: GettingStartedPageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string }),
    cookies(),
    params.then(({ gymId: id }) => getAuthorizedActionContext({ gymId: id })),
  ]);

  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  const selectedBranchId = branchContext.selectedBranchId;
  const supabase = await createClient();

  // Execute parallel HEAD count queries for live operational progress
  let membersQuery = supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId);
  if (selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", selectedBranchId);
  }

  let plansQuery = supabase
    .from("membership_plans")
    .select("id, branches!inner(gym_id)", { count: "exact", head: true })
    .eq("branches.gym_id", gymId)
    .eq("is_active", true);
  if (selectedBranchId) {
    plansQuery = plansQuery.eq("branch_id", selectedBranchId);
  }

  let membershipsQuery = supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId);
  if (selectedBranchId) {
    membershipsQuery = membershipsQuery.eq("branch_id", selectedBranchId);
  }

  const [membersRes, plansRes, membershipsRes] = await Promise.all([
    membersQuery,
    plansQuery,
    membershipsQuery,
  ]);

  const membersCount = membersRes.count ?? 0;
  const plansCount = plansRes.count ?? 0;
  const membershipsCount = membershipsRes.count ?? 0;
  const branchesCount = authContext.branches.length;

  const isStep1Done = plansCount > 0;
  const isStep2Done = membersCount > 0;
  const isStep3Done = membershipsCount > 0;
  const isStep4Done = membershipsCount > 0 && isStep1Done && isStep2Done;

  const completedSteps =
    (isStep1Done ? 1 : 0) +
    (isStep2Done ? 1 : 0) +
    (isStep3Done ? 1 : 0) +
    (isStep4Done ? 1 : 0);

  const readyForOps = isStep1Done && isStep2Done && isStep3Done;
  const completionPercentage = Math.round((completedSteps / 4) * 100);

  const csvTemplateData =
    "Full Name,Phone,Email,Notes\n" +
    "Rahul Sharma,9876543210,rahul@example.com,Morning Batch\n" +
    "Priya Patel,+91 98765 43211,priya@example.com,Personal Training\n" +
    "Amit Verma,09876543212,,Evening Regular";

  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplateData)}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-foreground">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Operational Onboarding Guide</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Getting Started with GymApra
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Complete the 4 foundational steps below to unlock your automated front desk, check-ins, and financial tracking.
          </p>
        </div>

        {/* 1-Tap Template Download */}
        <div className="flex items-center gap-2">
          <a
            href={csvDataUri}
            download="gymapra_member_import_template.csv"
            className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-card hover:bg-muted/80 text-foreground border border-border text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
            title="Download blank sample spreadsheet for bulk member import"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Download CSV Template</span>
          </a>
        </div>
      </div>

      {/* Live Readiness Hero Card */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-5 sm:p-6 text-card-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0 ${
                readyForOps
                  ? "bg-emerald-500/10 text-emerald-600 shadow-xs"
                  : "bg-primary/10 text-primary shadow-xs"
              }`}
            >
              {readyForOps ? (
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
              ) : (
                <Compass className="w-6 h-6 sm:w-7 sm:h-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {readyForOps
                    ? "Your Gym Workspace is Operations-Ready!"
                    : `Setup Progress: ${completionPercentage}% Completed`}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    readyForOps
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {readyForOps ? "Ready" : `${completedSteps}/4 Steps`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {readyForOps
                  ? "All 4 foundational operations are active. You can now enroll new members, record fees, and take attendance."
                  : "Follow the checklist below to configure your plans and member roster."}
              </p>
            </div>
          </div>

          {readyForOps && (
            <Link
              href={`/app/${gymId}/dashboard`}
              className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-5 bg-primary hover:opacity-95 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition-all shrink-0"
            >
              <span>Go to Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                readyForOps ? "bg-emerald-500" : "bg-primary"
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4-Step Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Step 1: Membership Pricing Plans */}
        <div
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
            isStep1Done
              ? "bg-card border-border shadow-xs"
              : "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isStep1Done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isStep1Done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step 1
                </span>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Configure Membership Plans
                </h3>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                isStep1Done
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {isStep1Done ? `${plansCount} Plans Active` : "Required"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-3">
            Create standard pricing tiers (e.g. Monthly, Quarterly, Annual) with duration in days and fees.
          </p>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{plansCount} active plan(s)</span>
            </span>
            <Link
              href={`/app/${gymId}/memberships?tab=plans`}
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>{isStep1Done ? "Manage Plans" : "+ Create First Plan"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Step 2: Register or Import Members */}
        <div
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
            isStep2Done
              ? "bg-card border-border shadow-xs"
              : "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isStep2Done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isStep2Done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step 2
                </span>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Build Member Roster
                </h3>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                isStep2Done
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {isStep2Done ? `${membersCount} Enrolled` : "Required"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-3">
            Quick-enroll members individually or upload existing member spreadsheets using our bulk importer.
          </p>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{membersCount} registered member(s)</span>
            </span>
            <Link
              href={`/app/${gymId}/members`}
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>{isStep2Done ? "View Members Roster" : "Enroll / Import Members"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Step 3: Assign Membership Plans */}
        <div
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
            isStep3Done
              ? "bg-card border-border shadow-xs"
              : "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isStep3Done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isStep3Done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step 3
                </span>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Assign Membership Plans
                </h3>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                isStep3Done
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {isStep3Done ? `${membershipsCount} Contracts Active` : "Required"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-3">
            Bulk-assign imported members to pricing plans to generate valid digital passes and track dues.
          </p>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{membershipsCount} contract(s) issued</span>
            </span>
            <Link
              href={`/app/${gymId}/memberships?tab=unassigned`}
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>{isStep3Done ? "Manage Assignments" : "Assign Plans in Bulk"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Step 4: Issue Contract & Attendance */}
        <div
          className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
            isStep4Done
              ? "bg-card border-border shadow-xs"
              : "bg-card border-border shadow-xs opacity-90"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isStep4Done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isStep4Done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step 4
                </span>
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Start Front Desk & Attendance
                </h3>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                isStep4Done
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isStep4Done ? "Operations Ready" : "Pending"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-3">
            Launch the reception attendance kiosk to record and verify daily check-ins for active members.
          </p>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Front desk check-in system</span>
            </span>
            <Link
              href={`/app/${gymId}/attendance`}
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Launch Front Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* CSV Template Quick Guide Card */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-5 sm:p-6 text-card-foreground">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Bulk Member Import Format Specifications
            </h3>
            <p className="text-sm text-muted-foreground">
              Easily migrate from Excel, WhatsApp contacts, or previous gym software
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-xs border-b border-border">
              <tr>
                <th className="p-3 pl-4">Column Header</th>
                <th className="p-3">Required?</th>
                <th className="p-3">Accepted Formats</th>
                <th className="p-3 pr-4">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground font-medium">
              <tr>
                <td className="p-3 pl-4 font-bold text-foreground">Full Name</td>
                <td className="p-3"><span className="text-emerald-600 font-bold">Required</span></td>
                <td className="p-3 text-muted-foreground">Minimum 2 characters</td>
                <td className="p-3 pr-4 font-mono">Rahul Sharma</td>
              </tr>
              <tr>
                <td className="p-3 pl-4 font-bold text-foreground">Phone</td>
                <td className="p-3"><span className="text-emerald-600 font-bold">Required</span></td>
                <td className="p-3 text-muted-foreground">10 digits, +91..., 0..., spaced or hyphenated</td>
                <td className="p-3 pr-4 font-mono">9876543210</td>
              </tr>
              <tr>
                <td className="p-3 pl-4 font-bold text-foreground">Email</td>
                <td className="p-3"><span className="text-muted-foreground">Optional</span></td>
                <td className="p-3 text-muted-foreground">Standard email format</td>
                <td className="p-3 pr-4 font-mono">rahul@example.com</td>
              </tr>
              <tr>
                <td className="p-3 pl-4 font-bold text-foreground">Notes</td>
                <td className="p-3"><span className="text-muted-foreground">Optional</span></td>
                <td className="p-3 text-muted-foreground">Trainer, medical, or shift notes (max 500 chars)</td>
                <td className="p-3 pr-4 font-mono">Morning Batch</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
