import { notFound } from "next/navigation";
import AdminClient from "@/components/admin/AdminClient";
import { getAuthUser } from "@/lib/auth";
import { isAdmin } from "@/lib/userRecord";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  description: "Members, access and assistant usage.",
};

// Members who aren't admins get the same 404 as any unknown page.
export default async function AdminPage() {
  const user = await getAuthUser();
  if (!isAdmin(user)) notFound();
  return <AdminClient currentUserId={user.id} />;
}
