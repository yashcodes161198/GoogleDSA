import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getThemeSettings } from "@/lib/themes/server";
import { getUser } from "@/lib/auth";
import { themeVariables } from "@/lib/themes/catalog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Google DSA Prep",
  description:
    "Track Google interview DSA questions, run mock interviews, and review with spaced repetition.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const [settings, user] = await Promise.all([getThemeSettings(), getUser()]);
  return (
    <html
      lang="en"
      data-theme-mode={settings.mode}
      style={themeVariables(settings)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider key={user?.id ?? "guest"} initialSettings={settings}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
