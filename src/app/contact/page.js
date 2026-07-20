import Link from "next/link";

export const metadata = {
  title: "Contact — Lancehawks",
  description:
    "Get in touch with Lancehawks. Reach us via email, phone, WhatsApp, or LinkedIn.",
  alternates: {
    canonical: "/contact",
  },
};

const contactItems = [
  {
    num: "01",
    label: "Email",
    value: "contact@lancehawks.com",
    href: "mailto:contact@lancehawks.com",
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
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    ),
  },
  {
    num: "02",
    label: "Phone",
    value: "+91 991 569 7333",
    href: "tel:+919915697333",
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
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
        />
      </svg>
    ),
  },
  {
    num: "03",
    label: "WhatsApp",
    value: "+91 991 569 7333",
    href: "https://wa.me/919915697333",
    icon: (
      <svg
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    num: "04",
    label: "LinkedIn",
    value: "linkedin.com/company/Lancehawks",
    href: "https://linkedin.com/company/Lancehawks",
    icon: (
      <svg
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
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
        className="relative px-8 lg:px-12 pb-20"
        style={{ paddingTop: "120px" }}
      >
        {/* Faint grid */}
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

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Overline */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <a
              href="https://lancehawks.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-muted! border border-white/8 px-2.5 py-1 tracking-wide cursor-pointer"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              A Lancehawks Product
            </a>
            <div className="flex items-center gap-3">
              <div className="w-5 h-px bg-brand-500" />
              <span className="text-caption uppercase tracking-[0.22em] text-brand-400! font-medium">
                Get in touch
              </span>
            </div>
          </div>

          <h1
            className="font-black leading-none tracking-tighter mb-6"
            style={{ fontSize: "clamp(3rem, 8vw, 7rem)" }}
          >
            Contact
            <br />
            <span className="text-brand-500">Lancehawks.</span>
          </h1>
          <p
            className="text-body text-muted! leading-relaxed max-w-md"
            style={{ lineHeight: "1.75" }}
          >
            Have a question, a project in mind, or just want to say hello? We
            are always open — reach us through any of the channels below.
          </p>
        </div>
      </section>

      {/* ── About strip ─────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 grid lg:grid-cols-2 gap-0">
          <div className="py-16 lg:pr-20 border-b lg:border-b-0 lg:border-r border-white/[0.06]">
            <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-4 font-medium">
              Who we are
            </p>
            <h2 className="text-h2 font-bold leading-tight mb-5">
              Building tools for makers.
            </h2>
            <p className="text-body text-muted! leading-relaxed">
              Lancehawks is a product studio focused on crafting precise,
              thoughtful software. Optimus is our internal company operating
              system, designed for teams that demand clarity in their workflow.
            </p>
          </div>
          <div className="py-16 lg:pl-20 flex flex-col justify-center gap-6">
            <div className="flex items-start gap-4">
              <div className="w-px h-10 bg-brand-500 shrink-0 mt-1" />
              <div>
                <p className="text-body-sm font-semibold text-heading! mb-1">
                  Fast response
                </p>
                <p className="text-body-sm text-muted! leading-relaxed">
                  We aim to respond to all inquiries within one business day.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-px h-10 bg-brand-500 shrink-0 mt-1" />
              <div>
                <p className="text-body-sm font-semibold text-heading! mb-1">
                  Open collaboration
                </p>
                <p className="text-body-sm text-muted! leading-relaxed">
                  Whether it&apos;s feedback, partnerships, or custom work — we
                  want to hear from you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact grid ────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-8 lg:px-12">
          <div className="flex items-baseline justify-between pb-6 border-b border-white/[0.06] pt-16">
            <div>
              <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-1 font-medium">
                Reach us
              </p>
              <h2 className="text-h1 font-bold">Contact channels.</h2>
            </div>
            <span
              className="text-caption text-muted! font-mono tabular-nums hidden sm:block"
              style={{ letterSpacing: "0.05em" }}
            >
              04 channels
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {contactItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  item.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="group p-8 border-b border-r border-white/[0.05] hover:bg-white/[0.02] transition-colors duration-200 block"
                style={{ textDecoration: "none" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span
                    className="font-mono text-caption text-muted! tabular-nums"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {item.num}
                  </span>
                  <span className="text-brand-500 group-hover:text-brand-400 transition-colors">
                    {item.icon}
                  </span>
                </div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted! mb-2 font-medium">
                  {item.label}
                </p>
                <p className="text-body font-semibold text-heading! group-hover:text-brand-400! transition-colors">
                  {item.value}
                </p>
                <div className="mt-5 flex items-center gap-2 text-caption text-muted! group-hover:text-brand-400! transition-colors">
                  <span>Open</span>
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] px-8 lg:px-12 py-28">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
          <div>
            <p className="text-caption uppercase tracking-[0.18em] text-brand-400! mb-5 font-medium">
              Ready to build?
            </p>
            <h2
              className="font-black text-heading! leading-none tracking-tighter"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
            >
              Take Optimus
              <br />
              for a spin.
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
              href="/"
              className="text-body-sm text-muted! hover:text-heading! transition-colors"
            >
              ← Back to home
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
  );
}
