"use client";

import { useCallback, useEffect, useState } from "react";
import { FounderPinGate } from "./gate/FounderPinGate";
import { RoomEntry } from "./gate/RoomEntry";
import { FounderRoom } from "./room/FounderRoom";
import { FOUNDER_ENDPOINTS, FOUNDER_LOCKED_EVENT, requestFounderJson } from "./services/founderApi";

/**
 * Founder Lobby flow: PIN gate -> entry threshold -> room. Any founder API
 * 403 (an expired 4-hour grant) returns to the gate.
 */
export default function FounderLobbyClient({ initialUnlocked = false, userName }) {
  const [phase, setPhase] = useState(initialUnlocked ? "entering" : "locked");
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState("");
  const enterRoom = useCallback(() => setPhase("room"), []);

  useEffect(() => {
    const returnToGate = () => setPhase("locked");
    window.addEventListener(FOUNDER_LOCKED_EVENT, returnToGate);
    return () => window.removeEventListener(FOUNDER_LOCKED_EVENT, returnToGate);
  }, []);

  const handleLock = async () => {
    if (isLocking) return;
    setIsLocking(true);
    setLockError("");
    try {
      await requestFounderJson(FOUNDER_ENDPOINTS.unlock, { method: "DELETE", fallbackError: "The room could not be locked." });
      setPhase("locked");
    } catch (error) {
      // Keep the room open, but say so: the server did not confirm the lock.
      setLockError(error.message);
    } finally {
      setIsLocking(false);
    }
  };

  if (phase === "locked") {
    return <FounderPinGate onUnlock={() => setPhase("entering")} />;
  }

  if (phase === "entering") {
    return <RoomEntry userName={userName} onComplete={enterRoom} />;
  }

  return <FounderRoom userName={userName} onLock={handleLock} isLocking={isLocking} lockError={lockError} />;
}
