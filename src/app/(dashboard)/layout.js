import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import DashboardShell from "@/components/layout/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider initialUser={user} checkSession={false}>
      <ThemeProvider>
        <DashboardShell>{children}</DashboardShell>
      </ThemeProvider>
    </AuthProvider>
  );
}
