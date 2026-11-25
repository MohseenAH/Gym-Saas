import Link from "next/link";
import { getCachedUser } from "@/lib/supabase/server";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Zap,
  Users,
  Layers,
  CalendarCheck,
  Wallet,
  Bell,
  BarChart3,
  Building2,
  Rocket,
  Check,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingHeroWaves } from "@/components/landing/landing-hero-waves";
import { LandingIllustration } from "@/components/landing/landing-illustration";
import { GymApraLogo } from "@/components/ui/gymapra-logo";
import { LandingFaq } from "@/components/landing/landing-faq";

// ─── Feature card data ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Users,
    title: "Member Management",
    desc: "Add, manage, and track all your gym members in one place.",
  },
  {
    icon: Layers,
    title: "Memberships & Renewals",
    desc: "Create plans, assign memberships, and handle renewals easily.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance",
    desc: "Quick and accurate member check-ins with daily records.",
  },
  {
    icon: Wallet,
    title: "Payments & Dues",
    desc: "Record payments, track pending dues, and stay on top of collections.",
  },
  {
    icon: Bell,
    title: "Follow-Ups",
    desc: "Never miss a renewal or payment with timely reminders.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    desc: "Get clear insights on members, revenue, and gym activity.",
  },
];

const STEPS = [
  {
    num: "1",
    icon: Building2,
    title: "Create your gym",
    desc: "Sign up and set up your gym in minutes.",
  },
  {
    num: "2",
    icon: Users,
    title: "Set up members and plans",
    desc: "Add members, create membership plans, and assign them.",
  },
  {
    num: "3",
    icon: Rocket,
    title: "Manage daily operations",
    desc: "Track attendance, payments, renewals, and more—effortlessly.",
  },
];

const WHY_ITEMS = [
  "Spend less time on manual paperwork",
  "Keep payments and renewals organized",
  "Run faster and smoother front-desk operations",
  "Get a clear view of your gym's activity and performance",
];

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const user = await getCachedUser();

  if (user) {
    const cookieStore = await cookies();
    const lastGymId = cookieStore.get("gymapra_last_gym_id")?.value;
    if (lastGymId) redirect(`/app/${lastGymId}/dashboard`);
    const destination = await resolvePostLoginRedirect();
    redirect(destination.path);
  }

  const currentYear = new Date().getFullYear();

  return (
    /*
     * Root wrapper — glacier-frost palette locked in with explicit hex values
     * so the page looks correct regardless of which app-theme the user has set.
     */
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{ background: "#DCEAF7", color: "#10243E", fontFamily: "inherit" }}
    >
      {/* ── 1. NAVBAR ─────────────────────────────────────────────────── */}
      <LandingNavbar />

      {/* ── 2. HERO ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32">
        {/* Wave background */}
        <LandingHeroWaves />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-[600px]">
            {/* Label pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#B8D0E6] text-[#2563EB] text-xs font-semibold mb-5 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              <span>Gym Management, Made Simple</span>
            </div>

            {/* Headline — matches reference exact copy + sizing */}
            <h1 className="text-[2.6rem] sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#10243E]">
              Run Your Gym.{" "}
              <span className="text-[#2563EB] block sm:inline">
                Simplify Everything.
              </span>
            </h1>

            {/* Sub-copy */}
            <p className="mt-5 text-[1rem] sm:text-lg text-[#10243E]/75 leading-relaxed max-w-[460px]">
              Manage members, attendance, payments, and renewals—
              <br className="hidden sm:block" />
              all in one place.
            </p>

            {/* Primary CTA */}
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-colors active:scale-[0.98] bg-[#2563EB] hover:bg-[#1D4ED8]"
              >
                Start 14-Day Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. FEATURES ───────────────────────────────────────────────── */}
      <section
        id="features"
        className="scroll-mt-20 py-16 sm:py-20"
        style={{ background: "#FFFFFF" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10243E]">
              Everything You Need to Run Your Gym
            </h2>
            <p className="mt-2.5 text-sm text-[#10243E]/65">
              A complete, easy-to-use solution for daily gym operations.
            </p>
          </div>

          {/* 6-card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group flex items-start gap-4 p-5 rounded-2xl border border-[#D8E9F5] hover:border-[#93C5FD] transition-all duration-200 bg-white"
                style={{ boxShadow: "0 1px 6px rgba(16,36,62,0.05)" }}
              >
                {/* Icon container */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 bg-[#EBF4FF] text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white"
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#10243E] mb-1 leading-snug">
                    {title}
                  </h3>
                  <p className="text-xs text-[#10243E]/65 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ───────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="scroll-mt-20 py-16 sm:py-20"
        style={{ background: "#DCEAF7" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10243E]">
              How GymApra Works
            </h2>
            <p className="mt-2.5 text-sm text-[#10243E]/65">
              Get your gym up and running in just a few simple steps.
            </p>
          </div>

          {/* Steps */}
          <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-3">
            {STEPS.map(({ num, icon: Icon, title, desc }, idx) => (
              <div key={num} className="flex lg:contents items-center gap-3 lg:gap-0 flex-1">
                {/* Card */}
                <div
                  className="relative flex-1 flex items-center gap-4 p-5 sm:p-6 rounded-2xl border border-[#C8DCF0] bg-white"
                  style={{ boxShadow: "0 1px 8px rgba(16,36,62,0.05)" }}
                >
                  {/* Number badge */}
                  <div className="absolute -top-3 left-5 w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shadow">
                    {num}
                  </div>
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#EBF4FF] text-[#2563EB]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#10243E] leading-snug">
                      {title}
                    </h3>
                    <p className="text-xs text-[#10243E]/65 mt-1 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>

                {/* Connector arrow — only between steps, hidden on mobile */}
                {idx < STEPS.length - 1 && (
                  <div
                    className="hidden lg:flex items-center justify-center shrink-0 w-7"
                    aria-hidden="true"
                  >
                    <ArrowRight className="w-5 h-5 text-[#2563EB]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHY GYMAPRA ────────────────────────────────────────────── */}
      <section
        className="py-16 sm:py-20"
        style={{ background: "#FFFFFF" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left — text */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10243E]">
                Why GymApra?
              </h2>
              <p className="mt-3 text-sm text-[#10243E]/70 leading-relaxed">
                Practical benefits that help you run a more organized and
                growing gym.
              </p>

              <ul className="mt-7 space-y-4">
                {WHY_ITEMS.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-sm font-medium text-[#10243E]">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — illustration */}
            <div className="flex justify-center">
              <LandingIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. CTA BANNER ─────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="scroll-mt-20 py-10 sm:py-12"
        style={{ background: "#DCEAF7" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-2xl px-8 py-10 sm:py-12 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{
              background: "linear-gradient(130deg, #2563EB 0%, #1D4ED8 100%)",
              boxShadow: "0 4px 24px rgba(37,99,235,0.3)",
            }}
          >
            <div className="text-left max-w-lg">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Your Gym Deserves Better Management.
              </h2>
              <p className="mt-2 text-sm text-blue-100 leading-relaxed">
                Start your 14-day free trial today and experience a simpler way
                to run your gym.
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#2563EB] font-bold text-sm shadow transition-colors hover:bg-blue-50 active:scale-[0.98]"
            >
              Start 14-Day Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="scroll-mt-20 py-16 sm:py-20"
        style={{ background: "#FFFFFF" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10243E]">
              Frequently Asked Questions
            </h2>
            <p className="mt-2.5 text-sm text-[#10243E]/65">
              Have questions? We&apos;ve got you covered.
            </p>
          </div>
          <LandingFaq />
        </div>
      </section>

      {/* ── 8. FOOTER ─────────────────────────────────────────────────── */}
      <footer
        className="border-t border-[#C4D9EC] mt-auto py-12 bg-[#DCEAF7]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="inline-flex items-center select-none mb-3">
                <GymApraLogo variant="dark" size="sm" />
              </Link>
              <p className="text-xs text-[#10243E]/65 leading-relaxed max-w-[200px]">
                A simple and powerful gym management solution for modern gym
                owners.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#10243E] mb-3">
                Product
              </h4>
              <ul className="space-y-2 text-xs text-[#10243E]/70">
                <li>
                  <a href="#features" className="hover:text-[#2563EB] transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-[#2563EB] transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-[#2563EB] transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#10243E] mb-3">
                Company
              </h4>
              <ul className="space-y-2 text-xs text-[#10243E]/70">
                <li>
                  <Link href="/login" className="hover:text-[#2563EB] transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#2563EB] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#2563EB] transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#10243E] mb-3">
                Support
              </h4>
              <ul className="space-y-2 text-xs text-[#10243E]/70 mb-4">
                <li>
                  <a
                    href="mailto:support@gymapra.com"
                    className="hover:text-[#2563EB] transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-[#2563EB] transition-colors">
                    Help Center
                  </a>
                </li>
              </ul>

              {/* Contact icons */}
              <div className="flex items-center gap-2">
                <a
                  href="mailto:support@gymapra.com"
                  aria-label="Email Support"
                  className="w-8 h-8 rounded-full border border-[#B8D0E6] bg-white text-[#2563EB] flex items-center justify-center transition-colors hover:bg-[#EBF4FF]"
                >
                  <Mail className="w-3.5 h-3.5" />
                </a>
                <a
                  href="tel:+919876543210"
                  aria-label="Call Support"
                  className="w-8 h-8 rounded-full border border-[#B8D0E6] bg-white text-[#2563EB] flex items-center justify-center transition-colors hover:bg-[#EBF4FF]"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
                <span
                  className="w-8 h-8 rounded-full border border-[#B8D0E6] bg-white text-[#2563EB] flex items-center justify-center"
                  aria-label="Location"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-5 border-t border-[#C0D6EC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#10243E]/60">
            <p>&copy; {currentYear} GymApra. All rights reserved.</p>
            <p>Built for modern gym owners.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
