import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/context/AuthContext";
import { QueryProvider } from "@/context/QueryContext";
import { ThemeProvider } from "@/context/ThemeContext";
import DashboardShell from "@/components/layout/DashboardShell";

// The session check blocks the first load. Moving between workspace pages
// doesn't rerun this shared layout, and recent pages stay mounted.
export const instant = false;

export default async function DashboardLayout({ children }) {
  const user = await getAuthUser();
  if (!user) redirect("/");

  return (
    <AuthProvider initialUser={user} checkSession={false}>
      <QueryProvider>
        <ThemeProvider>
          <DashboardShell>{children}</DashboardShell>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
