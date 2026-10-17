"use client";

import { useState } from "react";
import { DEFAULT_COUNTDOWN } from "../constants";
import { CountdownSettings } from "../countdown/CountdownSettings";
import { MainGoal } from "../countdown/MainGoal";
import { useFounderResource } from "../hooks/useFounderResource";
import { useFounderTheme } from "../hooks/useFounderTheme";
import { useScrollSpy } from "../hooks/useScrollSpy";
import { FOUNDER_ENDPOINTS } from "../services/founderApi";
import { cx } from "../utils/cx";
import theme from "../styles/theme.module.css";
import { DeferredStation } from "./DeferredStation";
import { RoomHeader } from "./RoomHeader";
import { RoomMenu } from "./RoomMenu";
import { MAIN_GOAL_AREA, STATION_AREAS } from "./roomAreas";
import styles from "./FounderRoom.module.css";

export function FounderRoom({ userName, onLock, isLocking, lockError }) {
  const lobbyTheme = useFounderTheme();
  const { scrollRef, activeArea, registerArea, moveToArea } = useScrollSpy(MAIN_GOAL_AREA);
  const countdownResource = useFounderResource(FOUNDER_ENDPOINTS.countdown, "countdown", {
    fallbackError: "The shared countdown is unavailable.",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const countdown = countdownResource.data || DEFAULT_COUNTDOWN;
  const loadState = countdownResource.loading ? "loading" : countdownResource.error ? "error" : "ready";

  const openTimer = () => {
    moveToArea(MAIN_GOAL_AREA);
    setSettingsOpen(true);
  };

  return (
    <main className={theme.surface} data-founder-theme={lobbyTheme.theme}>
      <RoomHeader
        userName={userName}
        theme={lobbyTheme.theme}
        themeNotice={lobbyTheme.themeNotice}
        onThemeChange={lobbyTheme.changeTheme}
        lockError={lockError}
        onLock={onLock}
        isLocking={isLocking}
      />

      <RoomMenu activeArea={activeArea} onSelectArea={moveToArea} onOpenTimer={openTimer} />

      <section ref={scrollRef} className={styles.room} aria-label="Founder Lobby room">
        <div className={styles.architecture} aria-hidden="true">
          <span className={styles.wallLeft} />
          <span className={styles.wallRight} />
          <span className={styles.floorLine} />
        </div>

        <section
          ref={(element) => registerArea(MAIN_GOAL_AREA, element)}
          className={cx(styles.roomZone, styles.mainGoalZone)}
          data-area={MAIN_GOAL_AREA}
          aria-label="Main goal countdown"
        >
          <MainGoal countdown={countdown} loadState={loadState} roomMessage={countdownResource.error} />
        </section>
        {STATION_AREAS.map(({ id, Station }) => (
          <section key={id} ref={(element) => registerArea(id, element)} className={styles.roomZone} data-area={id}>
            <DeferredStation><Station /></DeferredStation>
          </section>
        ))}
      </section>

      {settingsOpen && (
        <CountdownSettings
          countdown={countdown}
          onClose={() => setSettingsOpen(false)}
          onSaved={(nextCountdown) => {
            countdownResource.receive(nextCountdown);
            setSettingsOpen(false);
          }}
        />
      )}
    </main>
  );
}
