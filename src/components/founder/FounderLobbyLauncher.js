import OptimusLogo from "@/components/brand/OptimusLogo";
import Link from "next/link";

import styles from "./FounderLobbyLauncher.module.css";

export default function FounderLobbyLauncher() {
  return (
    <Link
      href="/founder"
      className={styles.launcher}
      aria-label="Enter Founder Lobby"
      title="Founder Lobby"
    >
      <span className={styles.glow} aria-hidden="true" />
      <OptimusLogo size={26} />
      <span className={styles.label}>Founder Lobby</span>
    </Link>
  );
}
