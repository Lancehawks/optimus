import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://optimus.lancehawks.com/",
  ),
  title: {
    default: "Optimus | Company Operating System",
    template: "%s | Optimus",
  },
  description:
    "The internal operating system for focused teams. Manage work, knowledge, schedules, and company momentum in one place.",
};

// Restore a valid device theme before React hydrates to avoid a color flash.
const themeScript = `
(function() {
  var allowedThemes = ['optimus-violet', 'ocean-blue', 'emerald', 'rose', 'amber', 'graphite', 'midnight'];
  var selectedTheme = 'optimus-violet';
  try {
    var storedTheme = localStorage.getItem('optimus-theme');
    if (allowedThemes.indexOf(storedTheme) !== -1) selectedTheme = storedTheme;
    localStorage.setItem('optimus-theme', selectedTheme);
  } catch(e) {}
  document.documentElement.setAttribute('data-theme', selectedTheme);
  document.documentElement.style.colorScheme = selectedTheme === 'midnight' ? 'dark' : 'light';
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="optimus-violet" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
