import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cricket" };

export default async function CricketIndex() {
  const articles = await prisma.article.findMany({
    where: { sport: "CRICKET", status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  return (
    <div className="max-w-5xl mx-auto px-5 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-cricket text-xs uppercase tracking-[0.2em] font-bold mb-2">Cricket</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Sessions, spells, and stats.
        </h1>
      </header>

      {articles.length === 0 ? (
        <div className="card p-8 text-center text-ink-dim">
          Cricket coverage launches in week 3 — once the football template is locked in, we clone it.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Link key={a.id} href={`/cricket/${a.slug}`} className="card p-5 block">
              <h2 className="text-xl font-bold leading-snug mb-2">{a.title}</h2>
              <p className="text-sm text-ink-dim line-clamp-2">{a.dek}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
