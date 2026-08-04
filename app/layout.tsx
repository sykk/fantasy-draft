import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";
import { IdentitySwitcher } from "@/components/IdentitySwitcher";
import { MobileNav } from "@/components/MobileNav";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbmono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Draft Lab — Rankings & Mock Drafts",
  description:
    "Build your own big board and practice snake drafts against realistic AI opponents.",
};

export const viewport: Viewport = {
  themeColor: "#0a0b12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${grotesk.variable} ${inter.variable} ${jbmono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="glass sticky top-0 z-40 border-x-0 border-t-0 bg-[#0c0e16]">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 overflow-x-auto px-4 sm:gap-6">
            <Link
              href="/"
              className="shrink-0 font-display text-xl font-bold tracking-[0.18em] text-accent"
            >
              DRAFT<span className="text-fg">LAB</span>
            </Link>
            <div className="hidden md:flex md:items-center md:gap-3 sm:gap-6">
              <NavLinks />
              <IdentitySwitcher />
            </div>
            <MobileNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
