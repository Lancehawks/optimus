"use client";

import { useCallback, useEffect, useRef } from "react";

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function playTone(audioContext, frequency, startTime, duration, volume) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function useNotificationSound() {
  const audioContextRef = useRef(null);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = getAudioContext();
    }

    return audioContextRef.current;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlockAudio = () => {
      const audioContext = ensureAudioContext();
      if (audioContext?.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [ensureAudioContext]);

  return useCallback(async () => {
    const audioContext = ensureAudioContext();
    if (!audioContext) return;

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (audioContext.state !== "running") return;

      const now = audioContext.currentTime;
      playTone(audioContext, 880, now, 0.09, 0.055);
      playTone(audioContext, 1175, now + 0.11, 0.12, 0.045);
    } catch {
      // Browsers can block audio until the user interacts with the page.
    }
  }, [ensureAudioContext]);
}
