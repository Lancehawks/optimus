import { redirect } from "next/navigation";
import FounderLobbyClient from "@/components/founder/FounderLobbyClient";
import { getAuthUser } from "@/lib/auth";
import { hasFounderAccess } from "@/lib/founderAccess";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Founder Lobby",
  description: "A private founder environment inside Optimus.",
};

export default async function FounderLobbyPage() {
  const user = await getAuthUser();
  if (!user) redirect("/?redirect=/founder");

  // A missing signing secret must show the PIN gate (whose unlock reports
  // "temporarily unavailable"), not crash the page with a 500.
  let unlocked = false;
  try {
    unlocked = await hasFounderAccess(user.id);
  } catch (error) {
    console.error("Founder Lobby access check error:", error);
  }

  return (
    <FounderLobbyClient
      initialUnlocked={unlocked}
      userName={user.full_name || user.email}
    />
  );
}
