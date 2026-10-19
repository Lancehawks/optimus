"use client";

import { TimerReset } from "lucide-react";
import { padIndex } from "../utils/format";
import { ROOM_AREAS } from "./roomAreas";
import styles from "./RoomMenu.module.css";

export function RoomMenu({ activeArea, onSelectArea, onOpenTimer }) {
  return (
    <nav className={styles.roomMenu} aria-label="Founder Lobby areas">
      <div className={styles.menuIntro}>
        <span>Workspace</span>
        <strong>Founder command center</strong>
      </div>
      <button className={styles.timerControl} type="button" onClick={onOpenTimer} title="Set the main countdown">
        <TimerReset aria-hidden="true" />
        <span>Set timer</span>
        <small>Control</small>
      </button>
      {ROOM_AREAS.map(({ id, label, title, Icon }, index) => (
        <button
          key={id}
          type="button"
          className={activeArea === id ? styles.activeMenuItem : ""}
          aria-current={activeArea === id ? "page" : undefined}
          onClick={() => onSelectArea(id)}
          title={title}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <small>{padIndex(index)}</small>
        </button>
      ))}
    </nav>
  );
}
