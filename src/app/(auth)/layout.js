import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  return (
    <AuthProvider initialUser={null} checkSession={false}>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}
