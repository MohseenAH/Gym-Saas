import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymApra V2 — Gym Management Platform",
  description: "Modern, high-velocity gym management and member intelligence OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
