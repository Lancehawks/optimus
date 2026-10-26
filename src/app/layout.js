import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The on-screen keyboard shrinks the layout, so editor toolbars stay visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://optimus.lancehawks.com/",
  ),
  title: {
    default: "Optimus",
    template: "%s · Optimus",
  },
  description: "The private workspace for the Lancehawks team.",
  robots: { index: false, follow: false },
};

// Resolve the saved appearance before React hydrates to avoid a colour flash.
// Legacy colour-theme ids from earlier releases fall back to the system setting.
// The signed-out screens in app/(auth) are always light.
const themeScript = `
(function() {
  var path = location.pathname.replace(/\\/+$/, '') || '/';
  var signedOut = path === '/' || path === '/invite' || path === '/forgot-password' || path === '/reset-password';
  var preference = 'system';
  try {
    var stored = localStorage.getItem('optimus-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') preference = stored;
    else if (stored === 'midnight') preference = 'dark';
  } catch (e) {}
  var dark = !signedOut && (preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
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
