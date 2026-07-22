"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleCheckBig,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import styles from "./login.module.css";

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <CircleCheckBig strokeWidth={2.35} />
    </span>
  );
}

function WorkspacePreview() {
  return (
    <div className={styles.previewScene} aria-hidden="true">
      <div className={`${styles.floatingCard} ${styles.scheduleCard}`}>
        <span><CalendarDays size={14} /></span>
        <div>
          <small>Up next · 10:30</small>
          <strong>Product review</strong>
        </div>
      </div>

      <div className={`${styles.floatingCard} ${styles.completedCard}`}>
        <CheckCircle2 size={16} />
        <div>
          <small>Task completed</small>
          <strong>Campaign brief</strong>
        </div>
      </div>

      <div className={styles.workspaceCard}>
        <div className={styles.workspaceTopbar}>
          <div><span /><span /><span /></div>
          <p>Today · Optimus</p>
          <MoreHorizontal size={14} />
        </div>

        <div className={styles.workspaceContent}>
          <div className={styles.workspaceGreeting}>
            <span>Tuesday, July 22</span>
            <strong>Good morning, Shivangi.</strong>
            <small>Your day is ready when you are.</small>
          </div>

          <div className={styles.workspaceStats}>
            <div><span>Today</span><strong>08</strong><small>3 complete</small></div>
            <div><span>Focus</span><strong>4.5h</strong><small>2 blocks</small></div>
            <div><span>Projects</span><strong>04</strong><small>On track</small></div>
          </div>

          <div className={styles.workspaceGrid}>
            <section>
              <header><strong>Today&apos;s focus</strong><span>View all</span></header>
              <div className={styles.previewTask}>
                <i><Check size={10} /></i>
                <p><s>Review campaign brief</s><small>Marketing</small></p>
              </div>
              <div className={styles.previewTask}>
                <i className={styles.previewTaskOpen} />
                <p><strong>Finalize homepage</strong><small>Optimus · High priority</small></p>
                <em>Today</em>
              </div>
              <div className={styles.previewTask}>
                <i className={styles.previewTaskOpen} />
                <p><strong>Prepare product review</strong><small>Product sprint</small></p>
              </div>
            </section>

            <section className={styles.timelinePanel}>
              <header><strong>Schedule</strong><MoreHorizontal size={12} /></header>
              <div><time>09:00</time><p><strong>Deep work</strong><small>Homepage concept</small></p></div>
              <div><time>10:30</time><p><strong>Product review</strong><small>Team call · 45 min</small></p></div>
              <div><time>13:00</time><p><strong>Lunch &amp; reset</strong></p></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.storyPanel} aria-label="Optimus workspace preview">
        <div className={styles.storyGrid} aria-hidden="true" />
        <div className={styles.storyGlow} aria-hidden="true" />

        <Link href="/" className={styles.brand} aria-label="Return to Optimus home">
          <BrandMark />
          <span>Optimus</span>
        </Link>

        <div className={styles.storyCopy}>
          <span className={styles.storyKicker}><Sparkles size={13} /> Your calm command center</span>
          <h1>Pick up exactly<br />where you left off.</h1>
          <p>Tasks, notes, calendar, and project context—ready and waiting in one focused workspace.</p>
        </div>

        <WorkspacePreview />

        <div className={styles.storyFooter}>
          <span><ShieldCheck size={14} /> Protected workspace</span>
          <span>Optimus by Lancehawks</span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formGlow} aria-hidden="true" />

        <div className={styles.formTopbar}>
          <Link href="/" className={styles.backLink}><ArrowLeft size={14} /> Back to home</Link>
          <Link href="/" className={styles.mobileBrand} aria-label="Return to Optimus home">
            <BrandMark />
            <span>Optimus</span>
          </Link>
        </div>

        <div className={styles.formWrap}>
          <div className={styles.formHeading}>
            <span>Welcome back</span>
            <h2>Sign in to Optimus</h2>
            <p>Enter your details to open your workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email">Email address</label>
              <div className={styles.inputWrap}>
                <Mail size={17} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="password">Password</label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              <div className={styles.inputWrap}>
                <Lock size={17} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
              aria-busy={isLoading || undefined}
            >
              {isLoading ? (
                <>
                  <span>Opening your workspace</span>
                  <span className={styles.progressDots} aria-hidden="true"><i /><i /><i /></span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className={styles.newAccount}>
            <span>New to Optimus?</span>
            <Link href="/signup">Create your workspace <ArrowRight size={14} /></Link>
          </div>

          <p className={styles.securityNote}><ShieldCheck size={13} /> Your session is encrypted and securely managed.</p>
        </div>

        <footer className={styles.formFooter}>
          <span>© {new Date().getFullYear()} Optimus</span>
          <a href="https://lancehawks.com" target="_blank" rel="noopener noreferrer">A Lancehawks product</a>
        </footer>
      </section>
    </main>
  );
}
