import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { BasketDrawer } from "@/components/BasketDrawer";

export const metadata: Metadata = {
  title: "SebEt — Bakıda Market Qiymət Müqayisəsi & Ağıllı Səbət",
  description:
    "Bravo, Araz, OBA və Bazarstore marketlərində real rəf qiymətlərini müqayisə edin, fiskal qəbzləri skan edərək xallar qazanın və səbətinizi ən yaxın 2 market arasında bölüşdürərək 25%-dək qənaət edin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" suppressHydrationWarning>
      <body className="antialiased bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
        {/* Mobile Device Frame / Container */}
        <div className="max-w-xl mx-auto min-h-screen bg-white dark:bg-slate-900 shadow-xl relative pb-24 flex flex-col border-x border-slate-200/60 dark:border-slate-800 transition-colors duration-200">
          <Navbar />
          <main className="flex-1 px-4 py-4">{children}</main>
          <BasketDrawer />
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
