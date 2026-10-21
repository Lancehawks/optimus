import Link from "next/link";
import { OptimusWordmark } from "@/components/brand/OptimusLogo";
import LancehawksMark from "@/components/brand/LancehawksMark";
import LightAppearance from "@/components/auth/LightAppearance";
import MottoPanel, { MottoCard } from "@/components/auth/MottoPanel";

/**
 * Frame for every signed-out screen: the form column on the canvas and the
 * Lancehawks motto panel on wide screens. Always light.
 */
export default function AuthFrame({ children }) {
  return (
    <main
      data-theme="light"
      className="grid min-h-dvh bg-canvas p-2 lg:grid-cols-[minmax(26rem,0.85fr)_1.15fr] lg:gap-2"
    >
      <LightAppearance />
      <section className="flex min-h-[calc(100dvh-1rem)] flex-col px-5 py-5 sm:px-10 lg:px-14 lg:py-8">
        <header className="flex items-center gap-3.5">
          <Link href="/" className="inline-flex" aria-label="Optimus sign in">
            <OptimusWordmark size={22} />
          </Link>
          <span className="h-4 w-px bg-border-strong" aria-hidden="true" />
          <span className="flex items-center gap-2">
            <LancehawksMark height={13} />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted">Lancehawks</span>
          </span>
        </header>

        <MottoCard className="mt-6 lg:hidden" />

        <div className="flex flex-1 items-start py-10 lg:items-center lg:py-12">
          <div className="w-full max-w-[22.5rem] animate-slide-up">{children}</div>
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>© {new Date().getFullYear()} Lancehawks</span>
          <Link href="/account-deletion" className="transition-colors hover:text-heading">
            Delete an account
          </Link>
        </footer>
      </section>
      <MottoPanel />
    </main>
  );
}

export function AuthHeading({ title, children }) {
  return (
    <div className="mb-8">
      <h1 className="text-display">{title}</h1>
      {children && <p className="mt-3 text-sm text-muted">{children}</p>}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/25 bg-danger-light px-3 py-2 text-xs text-danger">
      {message}
    </p>
  );
}
