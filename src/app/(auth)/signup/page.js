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
  UserRound,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import styles from "../login/login.module.css";

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
          <small>First focus block</small>
          <strong>Plan the product sprint</strong>
        </div>
      </div>

      <div className={`${styles.floatingCard} ${styles.completedCard}`}>
        <CheckCircle2 size={16} />
        <div>
          <small>Workspace ready</small>
          <strong>Your fresh start</strong>
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
            <span>Your first day</span>
            <strong>Welcome to your workspace.</strong>
            <small>A clear place for everything that matters.</small>
          </div>

          <div className={styles.workspaceStats}>
            <div><span>Today</span><strong>06</strong><small>Ready to plan</small></div>
            <div><span>Focus</span><strong>3.5h</strong><small>2 blocks</small></div>
            <div><span>Projects</span><strong>03</strong><small>All on track</small></div>
          </div>

          <div className={styles.workspaceGrid}>
            <section>
              <header><strong>Your starting point</strong><span>View all</span></header>
              <div className={styles.previewTask}>
                <i><Check size={10} /></i>
                <p><s>Create your Optimus account</s><small>Getting started</small></p>
              </div>
              <div className={styles.previewTask}>
                <i className={styles.previewTaskOpen} />
                <p><strong>Build your first project</strong><small>Workspace setup · High priority</small></p>
                <em>Today</em>
              </div>
              <div className={styles.previewTask}>
                <i className={styles.previewTaskOpen} />
                <p><strong>Plan tomorrow&apos;s focus</strong><small>Daily planning</small></p>
              </div>
            </section>

            <section className={styles.timelinePanel}>
              <header><strong>Schedule</strong><MoreHorizontal size={12} /></header>
              <div><time>09:00</time><p><strong>Daily plan</strong><small>Set priorities</small></p></div>
              <div><time>10:30</time><p><strong>Deep work</strong><small>Product sprint · 90 min</small></p></div>
              <div><time>13:00</time><p><strong>Lunch &amp; reset</strong></p></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const { addToast } = useToast();

  const passwordsDiffer = Boolean(confirmPassword) && password !== confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (passwordsDiffer) {
      addToast({ message: "Passwords do not match", type: "error" });
      return;
    }

    if (password.length < 8) {
      addToast({
        message: "Password must be at least 8 characters",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signup(email, password, fullName);
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
          <h1>Start clear.<br />Stay in control.</h1>
          <p>Create one focused workspace for your tasks, notes, calendar, and project context.</p>
        </div>

        <WorkspacePreview />

        <div className={styles.storyFooter}>
          <span><ShieldCheck size={14} /> Private by design</span>
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

        <div className={`${styles.formWrap} ${styles.signupFormWrap}`}>
          <div className={styles.formHeading}>
            <span>Get started</span>
            <h2>Create your workspace</h2>
            <p>A few details, then your focused workspace is ready.</p>
          </div>

          <form onSubmit={handleSubmit} className={`${styles.form} ${styles.signupForm}`}>
            <div className={styles.field}>
              <label htmlFor="fullName">Full name</label>
              <div className={styles.inputWrap}>
                <UserRound size={17} aria-hidden="true" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={isLoading}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>

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
              <label htmlFor="password">Password</label>
              <div className={styles.inputWrap}>
                <Lock size={17} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  aria-describedby="password-hint"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  aria-pressed={showPassword}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <small id="password-hint" className={styles.fieldHint}>Use 8 or more characters.</small>
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirm password</label>
              <div className={`${styles.inputWrap} ${passwordsDiffer ? styles.inputError : ""}`}>
                <Lock size={17} aria-hidden="true" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter it once more"
                  aria-invalid={passwordsDiffer || undefined}
                  aria-describedby={passwordsDiffer ? "confirm-password-error" : undefined}
                />
              </div>
              {passwordsDiffer && (
                <small id="confirm-password-error" className={styles.fieldError}>
                  Passwords do not match.
                </small>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
              aria-busy={isLoading || undefined}
            >
              {isLoading ? (
                <>
                  <span>Creating your workspace</span>
                  <span className={styles.progressDots} aria-hidden="true"><i /><i /><i /></span>
                </>
              ) : (
                <>
                  <span>Create workspace</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className={styles.newAccount}>
            <span>Already use Optimus?</span>
            <Link href="/login">Sign in <ArrowRight size={14} /></Link>
          </div>

          <p className={styles.securityNote}><ShieldCheck size={13} /> Your account details are encrypted and securely managed.</p>
        </div>

        <footer className={styles.formFooter}>
          <span>© {new Date().getFullYear()} Optimus</span>
          <a href="https://lancehawks.com" target="_blank" rel="noopener noreferrer">A Lancehawks product</a>
        </footer>
      </section>
    </main>
  );
}
