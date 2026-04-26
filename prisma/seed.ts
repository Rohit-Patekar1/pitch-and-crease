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
import { renderSvgsFromHtml } from "../src/lib/render-svg";

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
  /** One tweet per line (or per blank-line-separated paragraph). Last tweet's URL is added automatically. */
  twitterThread: string;
  /** Maps tweet positions to which SVG (by index) attaches there. */
  twitterImageMap: Array<{ tweetIndex: number; svgIndex: number; alt: string }>;
};

const SEEDS: SeedArticle[] = [
  {
    file: "atleti-vs-barca.html",
    slug: "atleti-1-2-barcelona-3-2-agg-2026-04-14",
    sport: "FOOTBALL",
    title: "Simeone strangled the comeback. Lookman did the rest.",
    dek: "Atlético Madrid 1-2 Barcelona (3-2 agg.) — A technical breakdown of how a side that had only 28.9% of the ball reached their first Champions League semi-final in nine years.",
    publishedAt: new Date("2026-04-14T22:00:00Z"),
    twitterThread: [
      "Atlético 1-2 Barcelona. Aggregate 3-2.\n\nSimeone strangled the comeback. Lookman did the rest. A side with 28.9% of the ball reached their first UCL semi in nine years.\n\nHere's how the tie was actually won 🧵👇",
      "Flick benched Lewandowski and Rashford for Torres and Gavi to press relentlessly.\n\nSimeone went 4-4-2 with Lookman wide left as a counter-weapon and Llorente given license to bomb forward as a hybrid right-mid.",
      "Barcelona dominated the first 24 minutes.\n\nYamal stripped Lenglet at 4' and rolled it through Musso's legs. Three Ferran Torres touches at 24' for the equaliser on aggregate. Two-nil. Tie alive.",
      "Then Llorente decided to run.\n\n60 yards. Past Eric García on the outside. Into the box. Inch-perfect ball to Lookman's run inside-to-out. The aggregate read 3-2 by the 31st minute.",
      "From 32' onwards, Atlético played the football their fans have a name for: el partido del Cholo.\n\nBarcelona finished with 71.1% possession and 2.28 xG. None of it mattered. Simeone's block conceded only low-quality shots Musso could see clean.",
      "Two ties, two Barcelona red cards, two Atlético wins. Cubarsí at 40' in leg one. Eric García at 79' in leg two. Both off transitions Flick's high line couldn't recover.\n\nThis is the Simeone project. Read the full breakdown 👇",
    ].join("\n\n"),
    twitterImageMap: [
      { tweetIndex: 1, svgIndex: 0, alt: "Atlético 4-4-2 vs Barcelona 4-3-3 starting XI on a tactical pitch" },
      { tweetIndex: 2, svgIndex: 1, alt: "Cumulative xG flow chart over 90 minutes — Barcelona 2.28, Atlético 1.71" },
      { tweetIndex: 3, svgIndex: 2, alt: "Lookman goal sequence — Llorente carry from his own half past Eric García, assist into the box" },
      { tweetIndex: 4, svgIndex: 3, alt: "Shot map for both teams, dots sized by xG" },
    ],
  },
  {
    file: "bazball-evolution.html",
    slug: "bazball-three-years-on",
    sport: "CRICKET",
    title: "Bazball, three years in — what England's experiment proved (and what it didn't).",
    dek:
      "When Brendon McCullum took over an England Test side that had won one of seventeen, he proposed an idea more philosophical than technical: declare the format dead, and play accordingly. Three years on, the data says he was half right.",
    publishedAt: new Date("2026-04-22T09:00:00Z"),
    twitterThread: [
      "Bazball, three years in.\n\nEngland Test run rate: 4.74 — the highest sustained tempo any side has ever produced over a comparable sample.\n\nW-L: 22-13.\n\nDid the experiment actually work? 🧵👇",
      "The brief was never about specific shots. It was about pace.\n\nEngland scored at 3.0 in the 2010s. Australia at 3.5. India 4.0+ at home. McCullum told Stokes: stop losing slowly. Make Test cricket watchable again.\n\nIt worked.",
      "Three patterns survive the noise:\n\n1. Scoring uplift is real and sustained — +49% on the same batters.\n2. Win rate vs top opposition is roughly unchanged from 2018-2021.\n3. The bowling was carried by attacking pitches, not attacking method.",
      "What it didn't prove: that an aggressive Test side can systematically beat the best in their own conditions.\n\nEngland have won a single Test in India since 2022 but lost the series. They have not played a four-Test rubber away from home and won.",
      "The fairer summary, three years in: Bazball is a domestic philosophy that travels poorly.\n\nThe 2027 winter, on Indian and Australian pitches that don't reward English seamers, will tell us if Bazball was a revolution or just a really good summer.\n\nFull breakdown 👇",
    ].join("\n\n"),
    twitterImageMap: [
      { tweetIndex: 0, svgIndex: 0, alt: "England Test run rate from 2010 to 2026 — step-change at McCullum's 2022 hire" },
    ],
  },
];

async function main() {
  for (const s of SEEDS) {
    const articlePath = join(__dirname, "seeds", s.file);
    const rawHtml = readFileSync(articlePath, "utf-8");
    const body = extractAndScopeBody(rawHtml);

    // Render every <svg> in the body to PNG for Twitter media uploads
    console.log(`Rendering SVGs for '${s.slug}'...`);
    const rendered = renderSvgsFromHtml(body);
    console.log(`  ${rendered.length} SVGs rendered`);

    // Build tweetImages from the seed's twitterImageMap
    const tweetImages = s.twitterImageMap
      .map((m) => {
        const png = rendered.find((r) => r.index === m.svgIndex);
        if (!png) {
          console.warn(`  no SVG at index ${m.svgIndex} for tweet ${m.tweetIndex}`);
          return null;
        }
        return { slot: m.tweetIndex, alt: m.alt, base64: png.base64 };
      })
      .filter(Boolean) as Array<{ slot: number; alt: string; base64: string }>;

    await prisma.article.upsert({
      where: { slug: s.slug },
      update: {
        body,
        title: s.title,
        dek: s.dek,
        status: "PUBLISHED",
        twitterThread: s.twitterThread,
        tweetImages: tweetImages as object,
      },
      create: {
        slug: s.slug,
        sport: s.sport,
        title: s.title,
        dek: s.dek,
        body,
        status: "PUBLISHED",
        publishedAt: s.publishedAt,
        source: "manual-seed",
        twitterThread: s.twitterThread,
        tweetImages: tweetImages as object,
      },
    });
    console.log(`Seeded ${s.sport} article '${s.slug}' with ${tweetImages.length} thread images.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
