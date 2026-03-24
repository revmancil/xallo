import { useEffect, useRef, useState } from "react";

const APP_URL = "/";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const features = [
  {
    icon: "💸",
    title: "Cash Flow Projection",
    desc: "See your exact balance after every upcoming bill and paycheck — before it happens. Know if you're at risk weeks in advance.",
    color: "from-blue-500/20 to-violet-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: "📋",
    title: "Smart Bill Tracking",
    desc: "Add billers once, auto-generate months of future bills. Mark paid with one tap, scan PDF statements to auto-fill amounts.",
    color: "from-violet-500/20 to-purple-500/10",
    border: "border-violet-500/20",
  },
  {
    icon: "📅",
    title: "Interactive Calendar",
    desc: "Visualize every bill due date and payday on a monthly calendar. At-a-glance financial awareness, no spreadsheet required.",
    color: "from-emerald-500/20 to-teal-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: "📊",
    title: "Spending Analytics",
    desc: "6-month spending trends, top 5 billers by cost, and subscription change detection — spot wasted money automatically.",
    color: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: "🏦",
    title: "Bank Sync via Plaid",
    desc: "Connect real bank accounts for live balance updates. Your Safety Gap stays accurate without manual entry.",
    color: "from-sky-500/20 to-cyan-500/10",
    border: "border-sky-500/20",
  },
  {
    icon: "🔒",
    title: "Security First",
    desc: "Full audit log of every action, two-factor authentication, and encrypted account storage. Your money data stays yours.",
    color: "from-rose-500/20 to-pink-500/10",
    border: "border-rose-500/20",
  },
];

const steps = [
  { n: "01", title: "Add your bank accounts", desc: "Enter your balances manually or sync live via Plaid. Your total available cash is calculated instantly." },
  { n: "02", title: "Set up your billers", desc: "Add each company you pay — utilities, subscriptions, rent, insurance. Set the recurrence and typical amount once." },
  { n: "03", title: "Track your paychecks", desc: "Log your income sources and pay dates. PrismClone builds your full cash flow timeline automatically." },
  { n: "04", title: "Know your Safe-to-Spend", desc: "The dashboard shows exactly how much money you can spend before your next payday after all bills are covered." },
];

const stats = [
  { value: "3 months", label: "of bills auto-generated" },
  { value: "One tap", label: "to mark bills paid" },
  { value: "Real-time", label: "cash flow projection" },
  { value: "Free", label: "no subscription needed" },
];

function MockDashboard() {
  return (
    <div className="relative w-full max-w-2xl mx-auto animate-float" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute inset-0 rounded-3xl glow-blue pointer-events-none" />
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d1424]">
        {/* Mock nav */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-[#0a1020]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/80 rounded-sm rotate-45" />
          </div>
          <span className="text-white font-bold text-sm">PrismClone</span>
          <div className="ml-auto flex gap-2">
            <div className="w-3 h-3 rounded-full bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-white/10" />
          </div>
        </div>
        {/* Mock content */}
        <div className="p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Available Cash", val: "$16,342", color: "text-white" },
              { label: "Bills Due (30d)", val: "$2,058", color: "text-white", badge: "3 Overdue" },
              { label: "Safety Gap", val: "$14,284", color: "text-emerald-400" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/8 p-3">
                <p className="text-[10px] text-white/50 mb-1">{s.label}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {s.badge && <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 rounded-full">{s.badge}</span>}
                </div>
                <p className={`text-base font-bold ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
          {/* Safe to spend */}
          <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Safe to Spend</p>
            <p className="text-2xl font-bold text-white mt-1">$16,327.51</p>
            <p className="text-[10px] text-white/40 mt-1">After paying 1 bill before Mar 27</p>
          </div>
          {/* Bills list */}
          <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/8">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Upcoming Bills</p>
            </div>
            {[
              { name: "Netflix", cat: "Entertainment", due: "Mar 5", amt: "$15.49", status: "Paid", color: "text-emerald-400 bg-emerald-500/10" },
              { name: "Electric Bill", cat: "Utilities", due: "Mar 12", amt: "$125.00", status: "Unpaid", color: "text-amber-400 bg-amber-500/10" },
              { name: "Rent", cat: "Housing", due: "Mar 15", amt: "$1,500", status: "Scheduled", color: "text-blue-400 bg-blue-500/10" },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-sm">
                  {b.name === "Netflix" ? "📺" : b.name === "Electric Bill" ? "⚡" : "🏠"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{b.name}</p>
                  <p className="text-[9px] text-white/40">{b.cat} · Due {b.due}</p>
                </div>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${b.color}`}>{b.status}</span>
                <p className="text-xs font-bold text-white">{b.amt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "hsl(224 71% 4%)" }}>
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/6 blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: "3s" }} />
      </div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8" style={{ background: "rgba(11,17,32,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <div className="w-4 h-4 border-2 border-white/80 rounded-sm rotate-45" />
            </div>
            <span className="text-white font-bold text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>PrismClone</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">How it works</a>
            <a href="#security" className="text-sm text-white/60 hover:text-white transition-colors">Security</a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={APP_URL}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35"
            >
              Open App →
            </a>
            <button
              className="md:hidden p-2 text-white/60 hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                {menuOpen
                  ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  : <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/8 px-4 py-4 space-y-3" style={{ background: "rgba(11,17,32,0.95)" }}>
            <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-1">Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-1">How it works</a>
            <a href="#security" onClick={() => setMenuOpen(false)} className="block text-sm text-white/70 hover:text-white py-1">Security</a>
            <a href={APP_URL} className="block text-center px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold mt-2">Open App →</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-6"
              style={{ animationDelay: "0ms", opacity: 1 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Free to use — no subscription required
            </div>
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              <span className="text-gradient">Know your money</span>
              <br />
              <span className="text-white">before it moves.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-10">
              PrismClone replaces the defunct Prism app — track bills, income, and bank balances in one dashboard. See exactly how much you can safely spend before your next payday.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={APP_URL}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all glow-primary hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/30"
              >
                Get Started Free
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </a>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/12 bg-white/5 text-white/80 font-semibold text-base hover:bg-white/10 hover:text-white transition-all"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Dashboard preview */}
          <FadeIn delay={200}>
            <MockDashboard />
          </FadeIn>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="relative py-12 px-4 sm:px-6 border-y border-white/8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <FadeIn key={i} delay={i * 80} className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-gradient-blue mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.value}</p>
              <p className="text-sm text-white/50">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Everything Prism had,<br />
              <span className="text-gradient">and more.</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Built from the ground up to replace the app millions relied on — with a modern stack and new capabilities.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className={`h-full p-6 rounded-2xl bg-gradient-to-br ${f.color} border ${f.border} hover:border-opacity-40 transition-all group cursor-default`}>
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gradient transition-all" style={{ fontFamily: "'Outfit', sans-serif" }}>{f.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 px-4 sm:px-6 border-t border-white/8">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Up and running in<br /><span className="text-gradient">under 5 minutes.</span>
            </h2>
          </FadeIn>

          <div className="space-y-6">
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="flex gap-5 p-6 rounded-2xl glass hover:border-white/15 transition-colors group">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-violet-600/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-blue-400 font-black text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.n}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg mb-1 group-hover:text-blue-200 transition-colors" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CASH FLOW HIGHLIGHT */}
      <section className="relative py-24 px-4 sm:px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn className="order-2 lg:order-1">
              <div className="space-y-5">
                {[
                  { bal: "$16,342.50", label: "Starting balance", type: "neutral" },
                  { bal: "−$14.99", label: "Amazon Prime · Mar 25", sub: "Balance: $16,327.51", type: "expense" },
                  { bal: "+$2,800.00", label: "Main Job · Mar 27", sub: "Balance: $19,127.51", type: "income" },
                  { bal: "−$1,500.00", label: "Rent · Apr 1", sub: "Balance: $17,627.51", type: "expense" },
                  { bal: "−$125.00", label: "Electric Bill · Apr 5", sub: "Balance: $17,502.51", type: "expense" },
                ].map((row, i) => (
                  <FadeIn key={i} delay={i * 80}>
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                      row.type === "income"
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : row.type === "expense"
                          ? "bg-white/[0.02] border-white/8"
                          : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <div>
                        <p className="text-sm font-semibold text-white">{row.label}</p>
                        {row.sub && <p className="text-xs text-white/40 mt-0.5">{row.sub}</p>}
                      </div>
                      <p className={`font-bold text-sm ${
                        row.type === "income" ? "text-emerald-400"
                          : row.type === "expense" ? "text-rose-400"
                            : "text-white"
                      }`}>{row.bal}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={100} className="order-1 lg:order-2">
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4">Running Balance Timeline</p>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
                See your future<br /><span className="text-gradient">before it arrives.</span>
              </h2>
              <p className="text-white/55 text-lg leading-relaxed mb-6">
                PrismClone projects your running bank balance across every upcoming bill and paycheck. Spot shortfalls — and fix them — before it's too late.
              </p>
              <ul className="space-y-3">
                {[
                  "Color-coded warnings when balance goes negative",
                  "Bills Before Next Payday calculated automatically",
                  "Safe-to-Spend updates in real time",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70 text-sm">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="relative py-24 px-4 sm:px-6 border-t border-white/8">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/30 mb-6">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Built with <span className="text-gradient">security in mind.</span>
            </h2>
            <p className="text-white/55 text-lg max-w-xl mx-auto mb-12">
              Your financial data is too important to be casual about. PrismClone treats security as a first-class feature, not an afterthought.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: "📋", title: "Audit Log", desc: "Every login, payment mark, and bank link is recorded. Full transparency into what's happening with your account." },
              { icon: "📱", title: "Two-Factor Auth", desc: "Protect your account with TOTP-based 2FA. Works with any authenticator app including Google Authenticator." },
              { icon: "🏦", title: "Plaid-Powered Sync", desc: "Bank connections use Plaid, the same secure infrastructure trusted by Venmo, Robinhood, and Coinbase." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="p-6 rounded-2xl glass text-left hover:border-violet-500/20 transition-colors">
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <h3 className="font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4 sm:px-6 border-t border-white/8">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 rounded-3xl blur-2xl bg-blue-600/20" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/30">
                <div className="w-9 h-9 border-3 border-white/80 rounded-lg rotate-45" style={{ borderWidth: "3px" }} />
              </div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Ready to take control<br /><span className="text-gradient">of your finances?</span>
            </h2>
            <p className="text-white/55 text-lg mb-10">
              PrismClone is free, private, and takes minutes to set up. No credit card, no subscription, no catch.
            </p>
            <a
              href={APP_URL}
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl transition-all glow-primary hover:scale-105 active:scale-95 shadow-2xl shadow-blue-600/30"
            >
              Start For Free
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </a>
            <p className="mt-4 text-sm text-white/30">No account needed — demo mode available instantly.</p>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-white/8 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <div className="w-3.5 h-3.5 border-2 border-white/80 rounded-sm rotate-45" />
            </div>
            <span className="text-white font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>PrismClone</span>
          </div>
          <p className="text-sm text-white/30 text-center">
            A spiritual successor to the Prism app. Built with ♥ for those who miss it.
          </p>
          <a href={APP_URL} className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Open App →
          </a>
        </div>
      </footer>
    </div>
  );
}
