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
  if (!user) redirect("/login?redirect=/founder");

  const unlocked = await hasFounderAccess(user.id);

  return (
    <FounderLobbyClient
      initialUnlocked={unlocked}
      userName={user.full_name || user.email}
    />
  );
}
