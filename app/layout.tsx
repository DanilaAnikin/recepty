import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
