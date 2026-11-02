import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/context/AuthContext";
import AuthFrame from "@/components/auth/AuthFrame";
import CopyrightYear from "@/components/auth/CopyrightYear";

// Signed-in members are redirected before anything renders.
export const instant = false;

export default async function AuthLayout({ children }) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <AuthProvider initialUser={null} checkSession={false}>
      {/* No ThemeProvider: signed-out screens are always light. */}
      <AuthFrame year={<CopyrightYear />}>{children}</AuthFrame>
    </AuthProvider>
  );
}
