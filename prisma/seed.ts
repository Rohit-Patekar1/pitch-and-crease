/**
 * Seed the database with two long-form articles + two Twitter-native social posts
 * so the dashboard has something to look at on first deploy.
 *
 * Article promo tweets are SINGLE tweets (not threads) with one image attached.
 * Social posts live only on X — no website article behind them.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { renderSvgsFromHtml } from "../src/lib/render-svg";

const prisma = new PrismaClient();

function extractAndScopeBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error("no <body> tag found");
  const bodyContent = bodyMatch[1];

  const styles: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRegex.exec(html)) !== null) styles.push(m[1]);

  const scopedCss = styles
    .map((raw) => {
      let css = raw;
      css = css.replace(/(^|\s|\})\s*:root\s*\{/g, "$1 .article-body {");
      css = css.replace(/(^|\s|\})\s*html\s*,\s*body\s*\{[^}]*\}/g, "$1");
      css = css.replace(/(^|\s|\})\s*body\s*\{/g, "$1 .article-body {");
      return css;
    })
    .join("\n");

  const bodyWithoutStyles = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  return `<style>${scopedCss}</style>\n${bodyWithoutStyles}`.trim();
}

// ---------- ARTICLES ----------

type SeedArticle = {
  file: string;
  slug: string;
  sport: "FOOTBALL" | "CRICKET";
  title: string;
  dek: string;
  publishedAt: Date;
  /** SINGLE promo tweet text (no URL — appended automatically). */
  promoTweet: string;
  /** Which body <svg> to render as the promo image. 0 = first svg. */
  promoImageSvgIndex: number;
  promoImageAlt: string;
};

const ARTICLES: SeedArticle[] = [
  {
    file: "atleti-vs-barca.html",
    slug: "atleti-1-2-barcelona-3-2-agg-2026-04-14",
    sport: "FOOTBALL",
    title: "Simeone strangled the comeback. Lookman did the rest.",
    dek: "Atlético Madrid 1-2 Barcelona (3-2 agg.) — A technical breakdown of how a side that had only 28.9% of the ball reached their first Champions League semi-final in nine years.",
    publishedAt: new Date("2026-04-14T22:00:00Z"),
    promoTweet:
      "Atlético Madrid 1-2 Barcelona. Aggregate 3-2.\n\nThey had 28.9% of the ball. They took one chance worth its xG. They reach their first UCL semi in nine years.\n\nA tactical breakdown of how Diego Simeone strangled the comeback.",
    promoImageSvgIndex: 0,
    promoImageAlt: "Atlético 4-4-2 vs Barcelona 4-3-3 starting XI on a tactical pitch",
  },
  {
    file: "bazball-evolution.html",
    slug: "bazball-three-years-on",
    sport: "CRICKET",
    title: "Bazball, three years in — what England's experiment proved (and what it didn't).",
    dek:
      "When Brendon McCullum took over an England Test side that had won one of seventeen, he proposed an idea more philosophical than technical: declare the format dead, and play accordingly. Three years on, the data says he was half right.",
    publishedAt: new Date("2026-04-22T09:00:00Z"),
    promoTweet:
      "Bazball, three years in.\n\nEngland's Test run rate: 4.74 — the highest sustained tempo any side has ever produced.\nW-L: 22-13.\n\nDid the experiment actually work? The data says yes, no, and it depends.",
    promoImageSvgIndex: 0,
    promoImageAlt: "England Test run rate 2010-2026 — visible step-change at McCullum's hiring in 2022",
  },
];

// ---------- SOCIAL POSTS (Twitter-native) ----------

type SeedSocial = {
  type: "ON_THIS_DAY" | "STAT_MOMENT" | "QUICK_TAKE" | "TRANSFER_FLASH" | "OTHER";
  sport: "FOOTBALL" | "CRICKET";
  title: string;            // internal admin name
  tweetText: string;        // 1-3 tweets, blank-line separated
  publishedAt: Date;
};

const SOCIAL_POSTS: SeedSocial[] = [
  {
    type: "ON_THIS_DAY",
    sport: "FOOTBALL",
    title: "On this day — Costa to Chelsea",
    tweetText: [
      "On this day in 2014, Diego Costa joined Chelsea for £32m.\n\nHe scored on his debut. He scored 20 in his first season. He won the league.\n\nThe best transfer of the Premier League's last decade — and possibly the Premier League era. 👇",
      "Three Premier League titles in his career. All three with Chelsea. All within five years.\n\nRetired at 35 with a Europa League and a La Liga on top of it.\n\nNo signing in modern football has returned more, for less, against a more terrified Premier League defence.",
    ].join("\n\n"),
    publishedAt: new Date("2026-04-15T10:00:00Z"),
  },
  {
    type: "ON_THIS_DAY",
    sport: "CRICKET",
    title: "On this day — Lara's 400",
    tweetText:
      "On this day in 2004, Brian Lara scored 400* against England in Antigua.\n\n778 minutes at the crease. 582 balls faced. 43 fours and 4 sixes. The only quadruple-century in Test cricket history.\n\nHe lost the series. He didn't care.",
    publishedAt: new Date("2026-04-12T08:00:00Z"),
  },
];

async function main() {
  // Articles
  for (const s of ARTICLES) {
    const articlePath = join(__dirname, "seeds", s.file);
    const rawHtml = readFileSync(articlePath, "utf-8");
    const body = extractAndScopeBody(rawHtml);

    console.log(`Rendering promo image for '${s.slug}'...`);
    const rendered = renderSvgsFromHtml(body);
    const heroSvg = rendered.find((r) => r.index === s.promoImageSvgIndex);
    const promoImage = heroSvg
      ? { alt: s.promoImageAlt, base64: heroSvg.base64 }
      : null;

    await prisma.article.upsert({
      where: { slug: s.slug },
      update: {
        body,
        title: s.title,
        dek: s.dek,
        status: "PUBLISHED",
        promoTweet: s.promoTweet,
        promoImage: (promoImage as object) ?? undefined,
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
        promoTweet: s.promoTweet,
        promoImage: (promoImage as object) ?? undefined,
      },
    });
    console.log(`  ✓ Article '${s.slug}' (${promoImage ? "with promo image" : "no image"})`);
  }

  // Social posts — keyed by title since SocialPost has no slug column
  for (const s of SOCIAL_POSTS) {
    const existing = await prisma.socialPost.findFirst({ where: { title: s.title } });
    if (existing) {
      await prisma.socialPost.update({
        where: { id: existing.id },
        data: { tweetText: s.tweetText, type: s.type, status: "PUBLISHED" },
      });
    } else {
      await prisma.socialPost.create({
        data: {
          type: s.type,
          sport: s.sport,
          title: s.title,
          tweetText: s.tweetText,
          status: "PUBLISHED",
          publishedAt: s.publishedAt,
          source: "manual-seed",
        },
      });
    }
    console.log(`  ✓ Social '${s.title}'`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
