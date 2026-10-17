"use client";

import OptimusLogo from "@/components/brand/OptimusLogo";


import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Flag,
  Lock,
  NotebookPen,
  ShieldCheck,
  Target,
  TimerReset,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import styles from "./FounderLobby.module.css";
import { FOUNDER_THEMES, founderTheme } from '@/lib/founderValues';
import {
  BuildingDayStation,
  LeadsStation,
  MilestonesStation,
  NotesStation,
  SalesStation,
  TargetsStation,
} from "./FounderStations";

const StableBuildingDayStation = memo(BuildingDayStation);
const StableMilestonesStation = memo(MilestonesStation);
const StableTargetsStation = memo(TargetsStation);
const StableSalesStation = memo(SalesStation);
const StableLeadsStation = memo(LeadsStation);
const StableNotesStation = memo(NotesStation);

const ENTRY_DURATION_MS = 900;

function firstNameOf(userName) {
  return String(userName || "Founder").trim().split(/\s+/)[0];
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function getRemainingTime(targetAt, now) {
  if (!targetAt) return null;

  const targetTime = new Date(targetAt).getTime();
  if (Number.isNaN(targetTime)) return null;

  const total = Math.max(0, targetTime - now);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total / 3_600_000) % 24),
    minutes: Math.floor((total / 60_000) % 60),
    seconds: Math.floor((total / 1_000) % 60),
    complete: total === 0,
  };
}

function FounderPinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pin.length !== 4 || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/founder/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Founder Lobby could not be unlocked.");
        setPin("");
        return;
      }

      onUnlock();
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.gate}>
      <header className={styles.gateHeader}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft aria-hidden="true" />
          <OptimusLogo size={28} />
          <span>Optimus</span>
        </Link>
        <span className={styles.secureLabel}>
          <ShieldCheck aria-hidden="true" /> Private access
        </span>
      </header>

      <section className={styles.gateScene} aria-labelledby="founder-gate-title">
        <div className={styles.gatePanel}>
          <p className={styles.eyebrow}>Founder mode / Private room</p>
          <h1 id="founder-gate-title">Step inside.</h1>
          <p className={styles.gateCopy}>
            Leave the everyday workspace behind and enter a quieter place.
          </p>

          <form className={styles.pinForm} onSubmit={handleSubmit}>
            <label htmlFor="founder-pin">Access PIN</label>
            <div className={styles.pinRow}>
              <div className={styles.pinField}>
                <input
                  id="founder-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={4}
                  pattern="[0-9]{4}"
                  placeholder="...."
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                    if (error) setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "founder-pin-error" : undefined}
                />
              </div>

              <button type="submit" disabled={pin.length !== 4 || isSubmitting}>
                {isSubmitting ? "Opening..." : "Enter room"}
              </button>
            </div>

            <p
              id="founder-pin-error"
              className={styles.pinMessage}
              aria-live="polite"
            >
              {error || "Enter your 4-digit PIN to cross the threshold."}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function RoomEntry({ userName, onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, ENTRY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className={styles.entry} aria-label="Entering Founder Lobby">
      <div className={styles.entryThreshold} aria-hidden="true">
        <span />
        <span />
      </div>
      <div className={styles.entryCopy}>
        <p>Founder Lobby</p>
        <h1>Welcome, {firstNameOf(userName)}.</h1>
        <span>Entering the room</span>
      </div>
    </main>
  );
}

function CountdownSettings({ countdown, onClose, onSaved }) {
  const [title, setTitle] = useState(countdown.title || "Main milestone");
  const [targetAt, setTargetAt] = useState(toDateTimeInput(countdown.targetAt));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !targetAt || isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/founder/countdown", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          targetAt: new Date(targetAt).toISOString(),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "The countdown could not be saved.");
        return;
      }

      onSaved(result.countdown);
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className={styles.settings} aria-labelledby="countdown-settings-title">
      <header>
        <div>
          <p>Room control</p>
          <h2 id="countdown-settings-title">Set the countdown</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close timer settings">
          <X aria-hidden="true" />
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <label htmlFor="countdown-title">
          Milestone name
          <input
            id="countdown-title"
            type="text"
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Main milestone"
          />
        </label>

        <label htmlFor="countdown-target">
          Target date and time
          <input
            id="countdown-target"
            type="datetime-local"
            min={toDateTimeInput(new Date())}
            value={targetAt}
            onChange={(event) => setTargetAt(event.target.value)}
          />
        </label>

        <p className={styles.settingsNote}>
          This timer is shared with everyone who enters the Founder Lobby.
        </p>
        <p className={styles.settingsError} role="alert">{error}</p>

        <button
          className={styles.saveButton}
          type="submit"
          disabled={!title.trim() || !targetAt || isSaving}
        >
          <Check aria-hidden="true" />
          {isSaving ? "Saving..." : "Set countdown"}
        </button>
      </form>
    </aside>
  );
}

function CountdownClock({ countdown, loadState, roomMessage }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(
    () => getRemainingTime(countdown.targetAt, now),
    [countdown.targetAt, now]
  );
  const timeUnits = [
    ["Hours", remaining?.hours],
    ["Minutes", remaining?.minutes],
    ["Seconds", remaining?.seconds],
  ];
  const targetLabel = countdown.targetAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(countdown.targetAt))
    : "No date has been set yet";

  return (
    <>
      <div
        className={styles.countdown}
        role="timer"
        aria-label={remaining
          ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds remaining`
          : "Countdown is not set"}
      >
        <section className={styles.dateCountdown} aria-label="Date countdown">
          <p><span>01</span> Date countdown</p>
          <div className={styles.dateValue}>
            <strong>
              {remaining?.days === undefined
                ? "--"
                : String(remaining.days).padStart(2, "0")}
            </strong>
            <span>Days remaining</span>
          </div>
        </section>

        <div className={styles.timeDivider} aria-hidden="true">
          <span />
          <p>Time countdown</p>
          <span />
        </div>

        <section className={styles.timeCountdown} aria-label="Time countdown">
          {timeUnits.map(([label, value]) => (
            <div className={styles.timeUnit} key={label}>
              <strong>
                {value === undefined ? "--" : String(value).padStart(2, "0")}
              </strong>
              <span>{label}</span>
            </div>
          ))}
        </section>
      </div>

      <footer className={styles.paperFooter}>
        <span>{remaining?.complete ? "Milestone reached" : targetLabel}</span>
        {loadState === "loading" && <small>Synchronising the room...</small>}
        {loadState === "error" && <small>{roomMessage}</small>}
      </footer>
    </>
  );
}

function DeferredStation({ children }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "65% 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={styles.deferredStation} aria-busy={!ready}>
      {ready ? children : <span className={styles.stationPlaceholder}>Preparing this area...</span>}
    </div>
  );
}

function FounderRoom({ userName, onLock, isLocking }) {
  const [theme, setTheme] = useState('burgundy');
  const [themeNotice, setThemeNotice] = useState('');
  useEffect(() => {
    const restore = () => {
      try { setTheme(founderTheme(localStorage.getItem('optimus:founder-theme'))); }
      catch { /* Storage can be disabled; the default still works. */ }
    };
    restore();
    window.addEventListener('storage', restore);
    return () => window.removeEventListener('storage', restore);
  }, []);
  const changeTheme = value => {
    const next = founderTheme(value);
    setTheme(next);
    try { localStorage.setItem('optimus:founder-theme', next); setThemeNotice(''); }
    catch { setThemeNotice('Theme applied for this visit. Browser storage is unavailable.'); }
  };
  const [countdown, setCountdown] = useState({
    title: "Main milestone",
    targetAt: null,
    updatedAt: null,
  });
  const [loadState, setLoadState] = useState("loading");
  const [roomMessage, setRoomMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeArea, setActiveArea] = useState("main-goal");
  const roomScrollRef = useRef(null);
  const areaRefs = useRef({});

  useEffect(() => {
    let active = true;

    async function loadCountdown() {
      try {
        const response = await fetch("/api/founder/countdown", {
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!active) return;

        if (!response.ok) {
          setRoomMessage(result.error || "The shared countdown is unavailable.");
          setLoadState("error");
          return;
        }

        setCountdown(result.countdown);
        setLoadState("ready");
      } catch {
        if (!active) return;
        setRoomMessage("The shared countdown is unavailable.");
        setLoadState("error");
      }
    }

    loadCountdown();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = roomScrollRef.current;
    if (!root) return undefined;

    const intersections = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => intersections.set(entry.target, entry));
        const visible = [...intersections.values()]
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.dataset.area) setActiveArea(visible.target.dataset.area);
      },
      { root, rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.2, 0.5] }
    );

    Object.values(areaRefs.current).forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const registerArea = useCallback((area, element) => {
    if (element) areaRefs.current[area] = element;
  }, []);

  const moveToArea = useCallback((area) => {
    setActiveArea(area);
    areaRefs.current[area]?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return (
    <main className={styles.lobby} data-founder-theme={theme}>
      <header className={styles.lobbyHeader}>
        <Link href="/dashboard" className={styles.lobbyBrand}>
          <OptimusLogo size={34} />
          <strong>Optimus</strong>
          <small>Founder Lobby</small>
        </Link>
        <div className={styles.lobbyControls}>
          <label className={styles.themePicker}>
            <span>Theme</span>
            <select aria-label="Founder Lobby theme" value={theme} onChange={event => changeTheme(event.target.value)}>
              {FOUNDER_THEMES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
          {themeNotice && <span role="status">{themeNotice}</span>}
          <span className={styles.roomStatus}>
            <i aria-hidden="true" /> Welcome, {firstNameOf(userName)}
          </span>
          <Link href="/dashboard" aria-label="Return to Optimus">
            <ArrowLeft aria-hidden="true" /><span>Optimus</span>
          </Link>
          <button type="button" onClick={onLock} disabled={isLocking} aria-label="Lock Founder Lobby">
            <Lock aria-hidden="true" /><span>{isLocking ? "Locking..." : "Lock"}</span>
          </button>
        </div>
      </header>

      <nav className={styles.roomMenu} aria-label="Founder Lobby areas">
        <div className={styles.menuIntro}>
          <span>Workspace</span>
          <strong>Founder command center</strong>
        </div>
        <button className={styles.timerControl} type="button" onClick={() => { moveToArea("main-goal"); setSettingsOpen(true); }} title="Set the main countdown">
          <TimerReset aria-hidden="true" />
          <span>Set timer</span>
          <small>Control</small>
        </button>
        <button
          type="button"
          className={activeArea === "main-goal" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "main-goal" ? "page" : undefined}
          onClick={() => moveToArea("main-goal")}
          title="Main goal countdown"
        >
          <CalendarClock aria-hidden="true" />
          <span>Main goal</span>
          <small>01</small>
        </button>
        <button
          type="button"
          className={activeArea === "building-day" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "building-day" ? "page" : undefined}
          onClick={() => moveToArea("building-day")}
          title="Day of building"
        >
          <Building2 aria-hidden="true" />
          <span>Building day</span>
          <small>02</small>
        </button>
        <button
          type="button"
          className={activeArea === "milestones" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "milestones" ? "page" : undefined}
          onClick={() => moveToArea("milestones")}
          title="Company milestones"
        >
          <Flag aria-hidden="true" />
          <span>Milestones</span>
          <small>03</small>
        </button>
        <button
          type="button"
          className={activeArea === "targets" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "targets" ? "page" : undefined}
          onClick={() => moveToArea("targets")}
          title="Company targets"
        >
          <Target aria-hidden="true" />
          <span>Targets</span>
          <small>04</small>
        </button>
        <button
          type="button"
          className={activeArea === "sales" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "sales" ? "page" : undefined}
          onClick={() => moveToArea("sales")}
          title="Sales overview"
        >
          <TrendingUp aria-hidden="true" />
          <span>Sales</span>
          <small>05</small>
        </button>
        <button
          type="button"
          className={activeArea === "leads" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "leads" ? "page" : undefined}
          onClick={() => moveToArea("leads")}
          title="Client lead sheet"
        >
          <UsersRound aria-hidden="true" />
          <span>Leads</span>
          <small>06</small>
        </button>
        <button
          type="button"
          className={activeArea === "notes" ? styles.activeMenuItem : ""}
          aria-current={activeArea === "notes" ? "page" : undefined}
          onClick={() => moveToArea("notes")}
          title="Founder notes"
        >
          <NotebookPen aria-hidden="true" />
          <span>Notes</span>
          <small>07</small>
        </button>
      </nav>

      <section ref={roomScrollRef} className={styles.room} aria-label="Founder Lobby room">
        <div className={styles.architecture} aria-hidden="true">
          <span className={styles.wallLeft} />
          <span className={styles.wallRight} />
          <span className={styles.floorLine} />
        </div>

        <section
          ref={(element) => registerArea("main-goal", element)}
          className={`${styles.roomZone} ${styles.mainGoalZone}`}
          data-area="main-goal"
          aria-label="Main goal countdown"
        >
        <article className={styles.countdownPaper}>
          <span className={styles.paperTabLeft} aria-hidden="true" />
          <span className={styles.paperTabRight} aria-hidden="true" />

          <header className={styles.paperHeader}>
            <p><i aria-hidden="true" /> Active milestone</p>
            <h1 id="founder-lobby-title">{countdown.title}</h1>
            <span className={styles.goalContext}>The one outcome the room is moving toward.</span>
          </header>

          <CountdownClock countdown={countdown} loadState={loadState} roomMessage={roomMessage} />
        </article>
        </section>
        <section ref={(element) => registerArea("building-day", element)} className={styles.roomZone} data-area="building-day"><DeferredStation><StableBuildingDayStation /></DeferredStation></section>
        <section ref={(element) => registerArea("milestones", element)} className={styles.roomZone} data-area="milestones"><DeferredStation><StableMilestonesStation /></DeferredStation></section>
        <section ref={(element) => registerArea("targets", element)} className={styles.roomZone} data-area="targets"><DeferredStation><StableTargetsStation /></DeferredStation></section>
        <section ref={(element) => registerArea("sales", element)} className={styles.roomZone} data-area="sales"><DeferredStation><StableSalesStation /></DeferredStation></section>
        <section ref={(element) => registerArea("leads", element)} className={styles.roomZone} data-area="leads"><DeferredStation><StableLeadsStation /></DeferredStation></section>
        <section ref={(element) => registerArea("notes", element)} className={styles.roomZone} data-area="notes"><DeferredStation><StableNotesStation /></DeferredStation></section>
      </section>

      {settingsOpen && (
        <>
          <button
            type="button"
            className={styles.settingsBackdrop}
            aria-label="Close timer settings"
            onClick={() => setSettingsOpen(false)}
          />
          <CountdownSettings
            countdown={countdown}
            onClose={() => setSettingsOpen(false)}
            onSaved={(nextCountdown) => {
              setCountdown(nextCountdown);
              setLoadState("ready");
              setRoomMessage("");
              setSettingsOpen(false);
            }}
          />
        </>
      )}

    </main>
  );
}

export default function FounderLobbyClient({ initialUnlocked = false, userName }) {
  const [phase, setPhase] = useState(initialUnlocked ? "entering" : "locked");
  const [isLocking, setIsLocking] = useState(false);

  const handleLock = async () => {
    if (isLocking) return;
    setIsLocking(true);
    try {
      const response = await fetch("/api/founder/unlock", {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) setPhase("locked");
    } catch {
      // Keep the room open if the server could not confirm the lock action.
    } finally {
      setIsLocking(false);
    }
  };

  if (phase === "locked") {
    return <FounderPinGate onUnlock={() => setPhase("entering")} />;
  }

  if (phase === "entering") {
    return <RoomEntry userName={userName} onComplete={() => setPhase("room")} />;
  }

  return <FounderRoom userName={userName} onLock={handleLock} isLocking={isLocking} />;
}
