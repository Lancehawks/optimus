import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://optimus.lancehawks.com/",
  ),
  title: {
    default: "Optimus — Personal Command Center",
    template: "%s | Optimus",
  },
  description:
    "Your personal command center to manage tasks, notes, calendars, whiteboards, and more. Powered by Lancehawks.",
};

// Inline script to apply saved theme before paint (prevents flash)
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('optimus-theme');
    if (t && t !== 'teal') {
      document.documentElement.setAttribute('data-theme', t === 'charcoal-gold' ? 'charcoal-gold' : t === 'warm-copper' ? 'warm-copper' : '');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
