import Link from "next/link";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://optimus.lancehawks.com/";

export const metadata = {
  title: "Optimus — The Company Operating System.",
  description:
    "Manage company work, knowledge, schedules, projects, resources, and decisions in one precisely designed internal workspace.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Optimus — The Company Operating System.",
    description:
      "Manage company work, knowledge, schedules, projects, resources, and decisions in one precisely designed internal workspace.",
    url: "/",
    siteName: "Optimus",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Optimus — The Company Operating System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Optimus — The Company Operating System.",
    description:
      "Manage company work, knowledge, schedules, projects, resources, and decisions in one internal workspace.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Optimus",
    url: SITE_URL,
    description:
      "Company operating system for managing work, knowledge, schedules, projects, resources, and decisions.",
    author: {
      "@type": "Organization",
      name: "Lancehawks",
      url: "https://lancehawks.com",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Optimus",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    description:
      "A company operating system for managing work, knowledge, schedules, projects, resources, and decisions in one place.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "Lancehawks",
      url: "https://lancehawks.com",
    },
  },
];

const features = [
  {
    num: "01",
    title: "Task Management",
    description:
      "Kanban boards, subtasks, priorities, dependencies, and bulk actions. Total command over your work.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
        />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Notes & Journals",
    description:
      "Rich text editor, daily journal, notebooks, and templates. Capture and retrieve ideas at the speed of thought.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Whiteboard",
    description:
      "Embedded Excalidraw canvas for system design, wireframes, and flowcharts. Think visually.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
        />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Calendar",
    description:
      "Monthly, weekly, and daily views. Create events, set recurrences, sync with Google Calendar.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
        />
      </svg>
    ),
  },
  {
    num: "05",
    title: "Bookmarks",
    description:
      "Save links with auto-fetched metadata. Organize into collections and search everything instantly.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
        />
      </svg>
    ),
  },
  {
    num: "06",
    title: "Habit Tracker",
    description:
      "Define habits, track streaks on a visual calendar, and study your consistency over time.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
        />
      </svg>
    ),
  },
  {
    num: "07",
    title: "Project Management",
    description:
      "Projects, milestones, task assignment, and progress tracking. Ship with clarity.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
      </svg>
    ),
  },
  {
    num: "08",
    title: "Study Resources",
    description:
      "PDFs, flashcards with spaced repetition, and a reading list with progress tracking.",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
        />
      </svg>
    ),
  },
];

const ticker = [
  "Task Management",
  "Notes & Journals",
  "Whiteboard",
  "Calendar",
  "Bookmarks",
  "Habit Tracker",
  "Projects",
  "Study Resources",
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker 48s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      <div className="marketing-shell min-h-screen bg-surface">
        {/* ── Navigation ──────────────────────────────────────────── */}
        <nav
          style={{ height: "56px" }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-12 border-b border-white/[0.06] bg-surface/90 backdrop-blur-xl"
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div
                style={{ width: "18px", height: "18px" }}
                className="border border-brand-500/50 flex items-center justify-center group-hover:border-brand-400/70 transition-colors"
              >
                <div
                  style={{ width: "7px", height: "7px" }}
                  className="bg-brand-500"
                />
              </div>
              <span className="text-body-sm font-bold tracking-[0.12em] text-heading!">
                OPTIMUS
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-4">
              <div className="w-px h-4 bg-white/10" />
              <a
                href="https://lancehawks.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption text-muted! tracking-wide cursor-pointer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                A Lancehawks Product
              </a>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-body-sm text-muted! hover:text-heading! transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 text-body-sm font-semibold bg-brand-500 hover:bg-brand-400 text-white transition-colors"
            >
              Get started
            </Link>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <section
          className="relative flex min-h-screen items-end px-8 lg:px-12 pb-24 pt-28"
          style={{ paddingTop: "120px" }}
        >
          {/* Faint engineering grid — structural lines only, not decorative */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: [
                "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
                "linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
              ].join(", "),
              backgroundSize: "88px 88px",
            }}
          />
          {/* Bottom vignette to merge into next section */}
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "160px",
              background:
                "linear-gradient(to bottom, transparent, var(--color-neutral-950, #0a0c10))",
            }}
          />

          <div className="relative z-10 w-full max-w-[1400px]">
            {/* Overline */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              {/* <a
                href="https://lancehawks.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption text-muted! border border-white/8 px-2.5 py-1 tracking-wide cursor-pointer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                A Lancehawks Product
              </a> */}
              <div className="flex items-center gap-3">
                <div className="w-5 h-px bg-brand-500" />
                <span className="text-caption uppercase tracking-[0.22em] text-brand-400! font-medium">
                  The company operating system
                </span>
              </div>
            </div>

            {/* Display headline */}
            <h1
              className="font-black leading-none tracking-tighter mb-12"
              style={{ fontSize: "clamp(3.25rem, 9vw, 8.5rem)" }}
            >
              The command
              <br />
              center for
              <br />
              <span className="text-brand-500">makers.</span>
            </h1>

            {/* Bottom row: subtext + CTAs */}
            <div className="flex flex-col lg:flex-row lg:items-end gap-8">
              <p
                className="text-body text-muted! leading-relaxed max-w-md"
                style={{ lineHeight: "1.75" }}
              >
                Tasks, notes, calendars, whiteboards, bookmarks, habits, and
                more — all in one precisely designed workspace built for people
                who refuse to compromise.
              </p>

              {/* <div className="flex items-center gap-4 lg:ml-auto shrink-0">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-white text-body-sm font-semibold transition-colors"
                >
                  Get started
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="text-body-sm text-muted! hover:text-heading! transition-colors"
                >
                  Sign in →
                </Link>
              </div> */}
            </div>
          </div>
        </section>

        {/* ── Ticker ──────────────────────────────────────────────── */}
        <div className="border-y border-white/[0.06] overflow-hidden py-4 select-none">
          <div
            className="ticker-track flex items-center gap-10 whitespace-nowrap"
            style={{ width: "max-content" }}
          >
            {[...ticker, ...ticker, ...ticker, ...ticker].map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-4 text-body-sm text-muted!"
              >
                <span className="w-1 h-1 bg-brand-500 shrink-0 inline-block" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Feature Grid ────────────────────────────────────────── */}
        <section className="px-8 lg:px-12 py-28">
          <div className="max-w-6xl mx-auto">
            {/* Section label row */}
            <div className="flex items-baseline justify-between mb-0 pb-6 border-b border-white/[0.06]">
              <div>
                <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-1 font-medium">
                  What&apos;s inside
                </p>
                <h2 className="text-h1 font-bold">Everything you need.</h2>
              </div>
              <span
                className="text-caption text-muted! font-mono tabular-nums hidden sm:block"
                style={{ letterSpacing: "0.05em" }}
              >
                09 modules
              </span>
            </div>

            {/* Grid — separated by borders only, no card backgrounds */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group p-8 border-b border-r border-white/[0.05] hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className="font-mono text-caption text-muted! tabular-nums"
                      style={{ letterSpacing: "0.08em" }}
                    >
                      {f.num}
                    </span>
                    <span className="text-brand-500 group-hover:text-brand-400 transition-colors">
                      {f.icon}
                    </span>
                  </div>
                  <h3 className="text-body font-semibold mb-2 text-heading!">
                    {f.title}
                  </h3>
                  <p className="text-body-sm text-muted! leading-relaxed">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Highlight: Tasks ────────────────────────────────────── */}
        <section className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-8 lg:px-12 grid lg:grid-cols-2">
            {/* Text */}
            <div className="py-24 lg:pr-20 flex flex-col justify-center">
              <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-6 font-medium">
                Tasks &amp; Projects
              </p>
              <h2 className="text-h1 font-bold leading-tight mb-6">
                Stay on top of everything.
              </h2>
              <p
                className="text-body text-muted! leading-relaxed mb-10"
                style={{ maxWidth: "360px" }}
              >
                Full Kanban boards, subtasks, priorities, dependencies, and
                project milestones — every workflow you need to ship.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Kanban & list views",
                  "Subtasks & task dependencies",
                  "Recurring tasks & bulk actions",
                  "Project milestones & progress",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-body-sm text-muted!"
                  >
                    <div className="w-px h-3.5 bg-brand-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup */}
            <div className="border-l border-white/[0.06] lg:pl-20 py-24 flex items-center">
              <div className="w-full space-y-1.5">
                {[
                  {
                    label: "Redesign token system",
                    tag: "Done",
                    tagStyle:
                      "text-green-400 border-green-500/20 bg-green-500/6",
                    done: true,
                  },
                  {
                    label: "API integration layer",
                    tag: "In Progress",
                    tagStyle: "text-blue-400 border-blue-500/20 bg-blue-500/6",
                    done: false,
                  },
                  {
                    label: "Write unit tests",
                    tag: "To Do",
                    tagStyle: "text-muted! border-white/10 bg-white/3",
                    done: false,
                  },
                  {
                    label: "Review & deploy to prod",
                    tag: "To Do",
                    tagStyle: "text-muted! border-white/10 bg-white/3",
                    done: false,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3.5 border border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.02] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`shrink-0 flex items-center justify-center border transition-colors ${
                          item.done
                            ? "border-brand-500/60 bg-brand-500/12"
                            : "border-white/15 group-hover:border-white/25"
                        }`}
                        style={{ width: "14px", height: "14px" }}
                      >
                        {item.done && (
                          <svg
                            className="text-brand-400"
                            style={{ width: "9px", height: "9px" }}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={3.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`text-body-sm truncate ${
                          item.done
                            ? "text-muted! line-through"
                            : "text-heading!"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={`text-caption font-medium px-2.5 py-0.5 border shrink-0 ml-3 ${item.tagStyle}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Highlight: Notes ────────────────────────────────────── */}
        <section className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-8 lg:px-12 grid lg:grid-cols-2">
            {/* Mockup — left */}
            <div className="border-r border-white/[0.06] lg:pr-20 py-24 flex items-center order-2 lg:order-1">
              <div className="w-full border border-white/[0.07]">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                  <div
                    style={{ width: "8px", height: "8px" }}
                    className="rounded-full bg-red-500/50"
                  />
                  <div
                    style={{ width: "8px", height: "8px" }}
                    className="rounded-full bg-amber-500/50"
                  />
                  <div
                    style={{ width: "8px", height: "8px" }}
                    className="rounded-full bg-green-500/50"
                  />
                  <span className="ml-3 text-caption text-muted! font-mono">
                    weekly-standup.md
                  </span>
                </div>
                {/* Content */}
                <div className="p-6 font-mono text-body-sm space-y-2.5">
                  <p className="text-heading! font-bold"># Weekly Standup</p>
                  <p className="text-muted!" style={{ lineHeight: "1.7" }}>
                    <span className="text-heading!">**Done:**</span> Finished
                    auth flow, deployed to staging
                  </p>
                  <p className="text-muted!" style={{ lineHeight: "1.7" }}>
                    <span className="text-heading!">**Today:**</span> Dashboard
                    UI, task API routes
                  </p>
                  <p className="text-muted!" style={{ lineHeight: "1.7" }}>
                    <span className="text-heading!">**Blockers:**</span> None 🚀
                  </p>
                  <div className="pt-3 border-t border-white/[0.06]">
                    <p className="text-caption text-muted!">
                      Tags: <span className="text-brand-400">work</span>
                      {" · "}
                      <span className="text-brand-400">standup</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="py-24 lg:pl-20 flex flex-col justify-center order-1 lg:order-2">
              <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-6 font-medium">
                Notes &amp; Knowledge
              </p>
              <h2 className="text-h1 font-bold leading-tight mb-6">
                Your second brain.
              </h2>
              <p
                className="text-body text-muted! leading-relaxed mb-10"
                style={{ maxWidth: "360px" }}
              >
                Write rich notes, keep a daily journal, organize everything with
                notebooks and tags, and find anything instantly with full-text
                search.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Rich text editor with Markdown",
                  "Daily journal with templates",
                  "Notebooks, tags & pinned notes",
                  "Full-text search across everything",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-body-sm text-muted!"
                  >
                    <div className="w-px h-3.5 bg-brand-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────── */}
        <section className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-8 lg:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06]">
              {[
                { value: "09", label: "Integrated modules" },
                { value: "∞", label: "Notes & journals" },
                { value: "1", label: "Place for everything" },
                { value: "0", label: "Compromises made" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="px-8 lg:px-12 py-16 text-center first:pl-0 last:pr-0"
                >
                  <p
                    className="font-black text-heading! leading-none mb-3"
                    style={{
                      fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-caption text-muted!">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────── */}
        <section className="border-t border-white/[0.06] px-8 lg:px-12 py-32">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
            <div>
              <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-5 font-medium">
                Ready to start?
              </p>
              <h2
                className="font-black text-heading! leading-none tracking-tighter"
                style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
              >
                Take control of
                <br />
                your work.
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-start lg:items-center gap-4 shrink-0">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-semibold text-body transition-colors"
              >
                Get started for free
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
              <Link
                href="/login"
                className="text-body-sm text-muted! hover:text-heading! transition-colors"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] px-8 lg:px-12 py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="border border-brand-500/50 flex items-center justify-center"
                style={{ width: "16px", height: "16px" }}
              >
                <div
                  style={{ width: "6px", height: "6px" }}
                  className="bg-brand-500"
                />
              </div>
              <span className="text-body-sm font-bold tracking-[0.12em] text-heading!">
                OPTIMUS
              </span>
              <span className="text-caption text-muted!">
                Company Operating System
              </span>
            </div>

            <div className="flex items-center gap-6">
              <Link
                href="/contact"
                className="text-caption text-muted! hover:text-heading! transition-colors"
              >
                Contact
              </Link>
              <Link
                href="/login"
                className="text-caption text-muted! hover:text-heading! transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-caption text-muted! hover:text-heading! transition-colors"
              >
                Get started
              </Link>
            </div>

            <div className="flex flex-col items-center sm:items-end gap-0.5">
              <p className="text-caption text-muted!">
                &copy; {new Date().getFullYear()} Optimus
              </p>
              <p className="text-caption text-muted! flex items-center gap-1.5">
                Powered by
                <a
                  href="https://lancehawks.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-heading! font-medium tracking-wide cursor-pointer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Lancehawks
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
