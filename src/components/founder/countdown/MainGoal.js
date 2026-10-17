"use client";

import { CountdownClock } from "./CountdownClock";
import styles from "./MainGoal.module.css";

/** The shared main-goal countdown "paper" at the top of the room. */
export function MainGoal({ countdown, loadState, roomMessage }) {
  return (
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
  );
}
