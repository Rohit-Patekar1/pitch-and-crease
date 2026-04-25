import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Football" };

export default async function FootballIndex() {
  const articles = await prisma.article.findMany({
    where: { sport: "FOOTBALL", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  return (
    <div className="max-w-5xl mx-auto px-5 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-football text-xs uppercase tracking-[0.2em] font-bold mb-2">Football</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Tactics, transfers, takes.
        </h1>
      </header>

      {articles.length === 0 ? (
        <div className="card p-8 text-center text-ink-dim">No football articles yet.</div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Link key={a.id} href={`/football/${a.slug}`} className="card p-5 block">
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h2 className="text-xl font-bold leading-snug">{a.title}</h2>
                {a.publishedAt && (
                  <time className="text-xs text-ink-dim shrink-0 font-mono">
                    {a.publishedAt.toISOString().slice(0, 10)}
                  </time>
                )}
              </div>
              <p className="text-sm text-ink-dim line-clamp-2">{a.dek}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
