import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_NAME = process.env.SITE_NAME || "Pitch and Crease";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Tactical football & cricket, every day`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Daily tactical analysis, on-this-day flashbacks, and recent match breakdowns from across world football and cricket.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2 group">
              <span className="text-xl font-extrabold tracking-tight">
                Pitch <span className="text-accent">&amp;</span> Crease
              </span>
              <span className="hidden sm:inline text-[11px] text-ink-dim uppercase tracking-widest">
                Daily tactical
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/football" className="hover:text-football transition-colors">
                Football
              </Link>
              <Link href="/cricket" className="hover:text-cricket transition-colors">
                Cricket
              </Link>
              <Link
                href="/admin"
                className="text-ink-dim hover:text-ink text-xs uppercase tracking-widest"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-line mt-24">
          <div className="max-w-5xl mx-auto px-5 py-8 text-xs text-ink-dim flex justify-between">
            <span>© {new Date().getFullYear()} Pitch and Crease</span>
            <span>Built with Next.js · Hosted on Railway</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
