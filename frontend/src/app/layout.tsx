import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { BasketDrawer } from "@/components/BasketDrawer";
import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "Sebet — Bakıda Market Qiymət Müqayisəsi & Ağıllı Səbət",
  description:
    "Bravo, Araz, OBA, Bazarstore, Al Market, Neptun və Spar marketlərində real rəf qiymətlərini müqayisə edin, həftəlik jurnallara baxın və səbətinizi ən yaxın marketlər arasında bölüşdürərək qənaət edin.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/sebet-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200 flex flex-col">
        <SplashScreen />
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-12">
          {children}
        </main>
        <BasketDrawer />
        <BottomNav />
      </body>
    </html>
  );
}
