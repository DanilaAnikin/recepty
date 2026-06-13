import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const themeBootstrapScript = `
  (function () {
    try {
      var raw = localStorage.getItem("recepty-terinky.next.v1");
      var mode = "system";
      if (raw) {
        var parsed = JSON.parse(raw);
        mode = parsed.themeMode || "system";
      }
      var resolved = mode === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : mode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    } catch (error) {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
    }
  })();
`;

export const metadata: Metadata = {
  title: "Recepty Terinky",
  description: "Domácí kuchařka na recepty, ingredience a zásoby.",
  manifest: "/manifest.webmanifest",
  applicationName: "Recepty Terinky",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Recepty Terinky",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Recepty Terinky",
    description: "Domácí kuchařka na recepty, ingredience a zásoby.",
    type: "website",
    locale: "cs_CZ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#171315" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body className={`${manrope.variable} ${fraunces.variable}`}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
