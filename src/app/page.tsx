import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recent = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });

  return (
    <div className="max-w-5xl mx-auto px-5 pt-12 pb-16">
      <section className="mb-14">
        <p className="text-accent text-xs uppercase tracking-[0.2em] font-bold mb-3">
          Daily tactical
        </p>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-4">
          The game, broken down.
          <br />
          <span className="text-ink-dim font-bold">Every day.</span>
        </h1>
        <p className="text-lg text-ink-dim max-w-2xl">
          Tactical analysis of football and cricket — recent matches, on-this-day flashbacks,
          transfer briefs, and player deep-dives. Written with the rigour of a beat reporter,
          read in the time of a coffee.
        </p>
        <div className="flex gap-3 mt-6">
          <Link
            href="/football"
            className="inline-flex items-center gap-2 bg-football px-5 py-2.5 rounded-lg font-semibold text-white"
          >
            Football →
          </Link>
          <Link
            href="/cricket"
            className="inline-flex items-center gap-2 bg-cricket px-5 py-2.5 rounded-lg font-semibold text-white"
          >
            Cricket →
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold tracking-tight">Latest</h2>
          <span className="text-xs text-ink-dim uppercase tracking-widest">
            {recent.length} {recent.length === 1 ? "story" : "stories"}
          </span>
        </div>
        {recent.length === 0 ? (
          <div className="card p-8 text-center text-ink-dim">
            No published articles yet. Run{" "}
            <code className="text-accent">npm run db:seed</code> to add a starter article.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {recent.map((a) => {
              const path = a.sport === "FOOTBALL" ? `/football/${a.slug}` : `/cricket/${a.slug}`;
              const accent = a.sport === "FOOTBALL" ? "text-football" : "text-cricket";
              return (
                <Link key={a.id} href={path} className="card p-5 block">
                  <div className={`text-[11px] uppercase tracking-widest font-bold mb-2 ${accent}`}>
                    {a.sport}
                  </div>
                  <h3 className="text-lg font-bold leading-snug mb-2">{a.title}</h3>
                  <p className="text-sm text-ink-dim line-clamp-3">{a.dek}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
