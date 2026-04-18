import Link from 'next/link';

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f4ff_1px,transparent_1px),linear-gradient(to_bottom,#f0f4ff_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60" />
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-hr-50/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-hr-100 bg-hr-50 px-3.5 py-1.5 text-xs font-semibold text-hr-700 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-hr-500 animate-pulse" />
          Career Intelligence Platform — Now in Beta
        </div>

        <h1 className="mx-auto max-w-3xl text-5xl font-black tracking-tight text-surface-900 leading-[1.05] sm:text-6xl">
          Know exactly where{' '}
          <span className="text-hr-600">your career stands</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-surface-500 leading-relaxed">
          HireRise analyses your skills, resume, and market data to give you a real-time
          Career Health Index — so you always know what to work on next.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-hr-600 px-8 text-sm font-bold text-white shadow-md hover:bg-hr-700 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Get started free
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-8 text-sm font-semibold text-surface-700 hover:bg-surface-50 transition-all"
          >
            Sign in
          </Link>
        </div>

        {/* Dashboard mockup */}
        <div className="mt-16 mx-auto max-w-4xl rounded-2xl border border-surface-100 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-surface-100 bg-surface-50 px-5 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-surface-400">app.hirerise.io/dashboard</span>
          </div>
          <div className="grid grid-cols-4 gap-px bg-surface-100 p-0">
            <div className="col-span-1 bg-white px-4 py-5 hidden sm:block">
              <div className="space-y-2">
                {['Dashboard', 'Skills', 'Resumes', 'Analytics', 'Profile'].map((item) => (
                  <div key={item} className={`rounded-lg px-3 py-2 text-xs font-medium ${item === 'Dashboard' ? 'bg-hr-50 text-hr-700' : 'text-surface-400'}`}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-3 bg-surface-50 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'CHI Score', value: '74', color: 'text-green-600' },
                  { label: 'Skill Gaps', value: '3', color: 'text-amber-600' },
                  { label: 'Market Fit', value: '82%', color: 'text-hr-600' },
                  { label: 'Salary', value: '$95k', color: 'text-surface-900' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-surface-100 bg-white p-3">
                    <p className="text-[10px] text-surface-400">{s.label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-surface-100 bg-white p-4">
                <p className="text-xs font-semibold text-surface-400 mb-3">Top Skill Gaps</p>
                <div className="space-y-2">
                  {[{ skill: 'System Design', gap: 'Critical' }, { skill: 'React', gap: 'Medium' }].map((g) => (
                    <div key={g.skill} className="flex items-center justify-between">
                      <span className="text-xs text-surface-700">{g.skill}</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${g.gap === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{g.gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const stats = [
    { value: '12K+', label: 'Professionals analysed' },
    { value: '94%', label: 'Accuracy on skill gap detection' },
    { value: '3.2x', label: 'Faster time to promotion' },
    { value: '40+', label: 'Supported industries' },
  ];

  return (
    <section className="border-y border-surface-100 bg-surface-50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black tracking-tight text-surface-900">{s.value}</p>
              <p className="mt-1 text-xs text-surface-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Upload your resume',
      description: 'Our AI extracts your skills, experience, and qualifications automatically.',
    },
    {
      num: '02',
      title: 'Set your target role',
      description: 'Tell us where you want to go — we map the exact gap between now and there.',
    },
    {
      num: '03',
      title: 'Get your CHI score',
      description: 'Your Career Health Index gives you a single, actionable number to track.',
    },
    {
      num: '04',
      title: 'Follow your roadmap',
      description: 'Prioritised skill recommendations based on real market demand data.',
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-hr-500 mb-3">How it works</p>
          <h2 className="text-3xl font-black tracking-tight text-surface-900">Four steps to career clarity</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-5 hidden h-px w-8 bg-surface-200 lg:block" style={{ right: '-2rem' }} />
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-hr-50 text-sm font-black text-hr-600 mb-4">
                {step.num}
              </div>
              <h3 className="text-sm font-bold text-surface-900 mb-2">{step.title}</h3>
              <p className="text-sm text-surface-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      icon: (
        <svg className="h-5 w-5 text-hr-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
        </svg>
      ),
      title: 'Career Health Index',
      description: 'A single, real-time score that tells you exactly how strong your career profile is against the current market.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: 'AI Skill Gap Detection',
      description: 'Compare your resume against thousands of job descriptions to find exactly which skills will unlock your next role.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Salary Benchmarking',
      description: 'See where you sit in the market distribution for your role, and understand what it takes to move to the next percentile.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: 'Market Demand Trends',
      description: 'Track which skills are rising in demand for your target role — so you invest your learning time where it matters most.',
    },
  ];

  return (
    <section className="bg-surface-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-hr-500 mb-3">Features</p>
          <h2 className="text-3xl font-black tracking-tight text-surface-900">Everything you need to grow</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-surface-100 bg-white p-6 hover:shadow-card-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50 mb-4">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-surface-900 mb-2">{f.title}</h3>
              <p className="text-xs text-surface-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  const testimonials = [
    {
      quote: "I got a promotion within 3 months of using HireRise. The skill gap analysis was spot on — I knew exactly what to study.",
      name: 'Sarah K.',
      role: 'Senior Engineer at Stripe',
      initials: 'SK',
    },
    {
      quote: "My CHI score went from 42 to 78 in two months. The clarity this gives you about where to focus is genuinely game-changing.",
      name: 'Marcus T.',
      role: 'Product Manager at Linear',
      initials: 'MT',
    },
    {
      quote: "I've tried every career tool out there. HireRise is the first one that actually tells me something actionable.",
      name: 'Priya M.',
      role: 'Data Scientist at Vercel',
      initials: 'PM',
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-hr-500 mb-3">Testimonials</p>
          <h2 className="text-3xl font-black tracking-tight text-surface-900">Trusted by ambitious professionals</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-surface-100 bg-surface-50 p-6">
              <div className="mb-4 text-hr-300">
                {"★★★★★"}
              </div>
              <p className="text-sm text-surface-600 leading-relaxed mb-5">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hr-100 text-xs font-bold text-hr-700">
                  {t.initials}
                </div>
                <div>
                  <p className="text-xs font-semibold text-surface-900">{t.name}</p>
                  <p className="text-[10px] text-surface-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24 bg-hr-600">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-black tracking-tight text-white mb-4">
          Ready to take control of your career?
        </h2>
        <p className="text-hr-200 mb-10 text-sm leading-relaxed">
          Join thousands of professionals who use HireRise to navigate their career with confidence.
          Free to start — no credit card needed.
        </p>
        <Link
          href="/register"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-sm font-bold text-hr-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          Start for free
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-surface-100 bg-white py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-hr-600">
            <span className="text-[10px] font-bold text-white">HR</span>
          </div>
          <span className="text-sm font-bold text-surface-900">HireRise</span>
        </div>
        <p className="text-xs text-surface-400">© {new Date().getFullYear()} HireRise. All rights reserved.</p>
        <div className="flex gap-6">
          {['Privacy', 'Terms', 'Contact'].map((link) => (
            <a key={link} href="#" className="text-xs text-surface-400 hover:text-surface-700 transition-colors">
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-surface-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-14 items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hr-600">
              <span className="text-xs font-bold text-white">HR</span>
            </div>
            <span className="text-sm font-bold text-surface-900">HireRise</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-hr-600 px-4 text-xs font-bold text-white hover:bg-hr-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
