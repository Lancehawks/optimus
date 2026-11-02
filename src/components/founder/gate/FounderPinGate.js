"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import OptimusLogo from "@/components/brand/OptimusLogo";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "../services/founderApi";
import theme from "../styles/theme.module.css";
import header from "../styles/header.module.css";
import styles from "./FounderPinGate.module.css";

const PIN_LENGTH = 4;

export function FounderPinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pin.length !== PIN_LENGTH || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      await requestFounderJson(FOUNDER_ENDPOINTS.unlock, {
        method: "POST",
        body: { pin },
        fallbackError: "Founder Lobby could not be unlocked.",
      });
      onUnlock();
    } catch (unlockError) {
      setError(unlockError.message);
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={theme.surface}>
      <header className={header.gateHeader}>
        <Link href="/dashboard" className={header.backLink}>
          <ArrowLeft aria-hidden="true" />
          <OptimusLogo size={28} />
          <span>Optimus</span>
        </Link>
        <span className={header.secureLabel}>
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
                  maxLength={PIN_LENGTH}
                  pattern="[0-9]{4}"
                  placeholder="••••"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH));
                    if (error) setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "founder-pin-error" : undefined}
                />
              </div>

              <button type="submit" disabled={pin.length !== PIN_LENGTH || isSubmitting}>
                {isSubmitting ? "Opening..." : "Enter room"}
              </button>
            </div>

            <p
              id="founder-pin-error"
              className={styles.pinMessage}
              data-tone={error ? "error" : undefined}
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
