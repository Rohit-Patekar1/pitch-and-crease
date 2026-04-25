import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const article = await prisma.article.findUnique({ where: { slug: params.slug } });
  if (!article) return { title: "Not found" };
  return {
    title: article.title,
    description: article.dek,
    openGraph: {
      title: article.title,
      description: article.dek,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      images: article.metaImage ? [{ url: article.metaImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.dek,
      images: article.metaImage ? [article.metaImage] : undefined,
    },
  };
}

export default async function FootballArticlePage({ params }: { params: { slug: string } }) {
  const article = await prisma.article.findUnique({ where: { slug: params.slug } });
  if (!article || article.sport !== "FOOTBALL" || article.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-5 pt-6">
        <Link href="/football" className="text-xs text-ink-dim uppercase tracking-widest hover:text-ink">
          ← All football
        </Link>
      </div>
      {/* The article body owns its presentation. We wrap it with .article-body so any
          (correctly-scoped) inline styles can target their content. */}
      <article
        className="article-body"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />
    </div>
  );
}
