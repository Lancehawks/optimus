import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Optimus - Personal Command Center",
  description:
    "Your personal assistant platform to manage work, life, and everything in between.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
