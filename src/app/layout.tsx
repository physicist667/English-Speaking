import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "TalkPal — разговорная практика английского с ИИ",
  description:
    "Голосовые диалоги с ИИ-собеседником для практики английского: настройка сложности речи, субтитры, загрузка слов и разбор ошибок после разговора.",
  keywords: [
    "английский",
    "практика",
    "разговорный английский",
    "ИИ собеседник",
    "voice chat",
    "english practice",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
