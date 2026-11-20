import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "GymApra V2 — Gym Management Platform",
  description: "Modern, high-velocity gym management and member intelligence OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymApra",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="emerald-mist" className="transition-colors duration-200" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-transparent text-foreground selection:bg-primary/20 selection:text-primary" suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var validThemes = ["emerald-mist", "glacier-frost", "obsidian-champagne", "electric-sapphire"];
                var t = localStorage.getItem("gymapra_theme");
                if (t === "alpine-jade" || t === "light" || t === "sage") t = "emerald-mist";
                else if (t === "glacier-slate") t = "glacier-frost";
                else if (t === "arctic-titanium") t = "electric-sapphire";
                else if (t === "royal-bordeaux" || t === "dark" || t === "iron") t = "obsidian-champagne";
                if (!t || validThemes.indexOf(t) === -1) {
                  t = "emerald-mist";
                }
                localStorage.setItem("gymapra_theme", t);
                document.documentElement.setAttribute("data-theme", t);
                document.documentElement.dataset.theme = t;
                var isDark = t === "obsidian-champagne" || t === "electric-sapphire";
                document.documentElement.classList.toggle("dark", isDark);
              } catch (e) {}
            `,
          }}
        />
        {children}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
