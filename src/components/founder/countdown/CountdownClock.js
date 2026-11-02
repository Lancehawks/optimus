"use client";

import { useMemo } from "react";
import { useNow } from "../hooks/useNow";
import { formatDateTime, padNumber } from "../utils/format";
import { getRemainingTime } from "../utils/time";
import styles from "./MainGoal.module.css";

const formatUnit = (value) => (value === undefined ? "--" : padNumber(value));

/** Live days/hours/minutes/seconds to the shared target. Re-renders every second. */
export function CountdownClock({ countdown, loadState, roomMessage }) {
  const now = useNow();
  const remaining = useMemo(() => getRemainingTime(countdown.targetAt, now), [countdown.targetAt, now]);
  const targetLabel = useMemo(
    () => (countdown.targetAt ? formatDateTime(countdown.targetAt) : "No date has been set yet"),
    [countdown.targetAt]
  );
  const timeUnits = [
    ["Hours", remaining?.hours],
    ["Minutes", remaining?.minutes],
    ["Seconds", remaining?.seconds],
  ];

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
            <strong>{formatUnit(remaining?.days)}</strong>
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
              <strong>{formatUnit(value)}</strong>
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
