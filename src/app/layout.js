import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
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
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
