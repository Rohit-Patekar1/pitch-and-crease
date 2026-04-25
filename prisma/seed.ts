/**
 * Seed the database with the Atlético vs Barcelona article so there's something
 * to look at on first deploy. Run with: `npm run db:seed`.
 *
 * Reads prisma/seeds/atleti-vs-barca.html, scopes the global CSS so it doesn't
 * leak into the rest of the site, and stores it as a published Article.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

/**
 * Pull the body content AND the head <style> blocks out of a self-contained HTML
 * doc, then transform any global CSS rules to be scoped to `.article-body` so the
 * article styling doesn't bleed into the surrounding site.
 *
 * Returns: <style>{scoped css}</style>{body inner html}
 */
function extractAndScopeBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error("no <body> tag found");
  const bodyContent = bodyMatch[1];

  // Collect every <style> block from the entire document (head + body).
  const styles: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRegex.exec(html)) !== null) {
    styles.push(m[1]);
  }

  const scopedCss = styles
    .map((raw) => {
      let css = raw;
      // :root { ... }  →  .article-body { ... }
      css = css.replace(/(^|\s|\})\s*:root\s*\{/g, "$1 .article-body {");
      // html, body { ... }  →  drop (page-level resets shouldn't leak)
      css = css.replace(/(^|\s|\})\s*html\s*,\s*body\s*\{[^}]*\}/g, "$1");
      // body { ... }  →  .article-body { ... }
      css = css.replace(/(^|\s|\})\s*body\s*\{/g, "$1 .article-body {");
      return css;
    })
    .join("\n");

  // Strip any <style> blocks already inside the body so we don't duplicate them.
  const bodyWithoutStyles = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  return `<style>${scopedCss}</style>\n${bodyWithoutStyles}`.trim();
}

type SeedArticle = {
  file: string;
  slug: string;
  sport: "FOOTBALL" | "CRICKET";
  title: string;
  dek: string;
  publishedAt: Date;
};

const SEEDS: SeedArticle[] = [
  {
    file: "atleti-vs-barca.html",
    slug: "atleti-1-2-barcelona-3-2-agg-2026-04-14",
    sport: "FOOTBALL",
    title: "Simeone strangled the comeback. Lookman did the rest.",
    dek: "Atlético Madrid 1-2 Barcelona (3-2 agg.) — A technical breakdown of how a side that had only 28.9% of the ball reached their first Champions League semi-final in nine years.",
    publishedAt: new Date("2026-04-14T22:00:00Z"),
  },
  {
    file: "bazball-evolution.html",
    slug: "bazball-three-years-on",
    sport: "CRICKET",
    title: "Bazball, three years in — what England's experiment proved (and what it didn't).",
    dek:
      "When Brendon McCullum took over an England Test side that had won one of seventeen, he proposed an idea more philosophical than technical: declare the format dead, and play accordingly. Three years on, the data says he was half right.",
    publishedAt: new Date("2026-04-22T09:00:00Z"),
  },
];

async function main() {
  for (const s of SEEDS) {
    const articlePath = join(__dirname, "seeds", s.file);
    const rawHtml = readFileSync(articlePath, "utf-8");
    const body = extractAndScopeBody(rawHtml);

    await prisma.article.upsert({
      where: { slug: s.slug },
      update: { body, title: s.title, dek: s.dek, status: "PUBLISHED" },
      create: {
        slug: s.slug,
        sport: s.sport,
        title: s.title,
        dek: s.dek,
        body,
        status: "PUBLISHED",
        publishedAt: s.publishedAt,
        source: "manual-seed",
      },
    });
    console.log(`Seeded ${s.sport} article '${s.slug}'.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
