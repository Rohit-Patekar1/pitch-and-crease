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
      "Atlético Madrid 1-2 Barcelona. Aggregate 3-2.\nAtleti go through to their first UCL semi-final in nine years.\nThey had 28.9% of the ball.\nThey took one chance worth its xG.\nHere's exactly how Diego Simeone strangled the comeback. 🧵👇",
      "Hansi Flick benched Lewandowski and Rashford for Ferran Torres and Gavi.\nWorkhorses for finishers. The mandate was clear: press relentlessly, force a turnover, find the away goal that would kill the tie.\nFor 24 minutes, it worked perfectly.",
      "4th minute. Yamal strips Lenglet on the touchline — under almost no pressure — and rolls a finish through Musso's legs.\nLenglet looked like he had the situation. He didn't.\nYamal at 19 turns half a yard into a goal.\n1-0 Barcelona. 2-1 on aggregate.",
      "24th minute. Three Ferran Torres touches: one to lose Lenglet, one to set himself, one to bend it inside the far post.\n2-0 on the night. 2-2 on aggregate.\nBy 25', Atlético's two-goal cushion was gone. The xG line read 1.4-0.1.",
      "Then Marcos Llorente decided to run.\n31st minute. Loose Barca turnover on the edge of Atléti's third. Llorente received, lifted his head, and saw what every counter-attacking coach dreams of: Eric García alone in 30 yards of pasture. No cover.\nHe went.",
      "The carry was sixty yards.\nHe beat García outside with a touch he had no business winning. Carried into the box rather than playing the cheap early ball. The delay drew Araújo across.\nLookman timed his run inside-to-out. The finish was almost incidental.",
      "1-2 on the night. 3-2 on aggregate.\nThat was Atlético's only meaningful sustained attack of the half. One quality transition. One finish. One goal.\nFor 60 more minutes, they didn't need another.",
      "From 32' onwards, Atlético played the football their fans have a name for: el partido del Cholo.\nTwo banks of four, ten yards apart. The front two pinning Barcelona's centre-backs. Pedri controlled the ball but every progressive pass had to thread through six bodies.",
      "Final stats:\n- Possession: Barca 71.1%, Atléti 28.9%\n- Shots: 15-15\n- xG: 2.28 vs 1.71\n- Shots on target: 8 vs 5\nOf those eight, seven from low-xG positions where Musso could see them clean. The block does the work.",
      "And at 79', Eric García was sent off for tripping Sørloth on a breakaway.\nTwo consecutive Atléti-Barca ties, both decided by a Barca centre-back red card on a transition.\nCubarsí at 40' in leg one. García at 79' in leg two.\nThis is the price of Flick's high line.",
      "That gap — between dominance and outcome — is the entire Simeone project.\nA back-six block on lost ball. Two strikers who never abandon the touchline. Two fullbacks that don't get caught upfield. One runner — Llorente — given license to detonate.\nThe rest refuses to leak.",
      "Atlético go to a semi vs the Bayern-Inter winner.\nThey have not been there since 2017 — the same vintage of Griezmann, Saúl, Koke, Oblak. Some things at this club never really change.\nThe block holds. The runner runs. Someone finishes.\nFull tactical breakdown 👇",
    ].join("\n\n"),
    twitterImageMap: [
      { tweetIndex: 1, svgIndex: 0, alt: "Atlético 4-4-2 vs Barcelona 4-3-3 starting XI on a tactical pitch" },
      { tweetIndex: 3, svgIndex: 1, alt: "Cumulative xG over 90 minutes — Barcelona reaches 2.28, Atlético 1.71" },
      { tweetIndex: 5, svgIndex: 2, alt: "Lookman goal sequence — Llorente carry past Eric García, assist into the box, Lookman finish" },
      { tweetIndex: 7, svgIndex: 3, alt: "Shot map for both teams; dot size = xG of each shot" },
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
      "Bazball, three years in.\nEngland Test run rate: 4.74 — the highest sustained tempo any side has ever produced over a comparable sample.\nW-L: 22-13.\nDid the experiment actually work? The data says yes, no, and it depends.\nA reckoning. 🧵👇",
      "The brief McCullum gave Stokes in 2022 was never about specific shots. It was about pace.\nEngland scored at 3.0 in the 2010s. Australia 3.5. India 4.0+ at home.\nMcCullum told Stokes: stop losing slowly. Make Test cricket watchable again.\nThat was the entire pitch.",
      "Three patterns survive the noise.\n1. Scoring uplift is real and sustained — +49% on the same batters.\n2. Run rate hit 4.74 by year two and never dipped.\n3. The bowling avg dropped only marginally — wickets were carried by pitches, not method.",
      "Where Bazball won: at home, vs second-tier opposition, in matches the previous regime would have ALSO won — just three days slower.\nHeadingley 2022. The West Indies sweep. Pakistan 3-0.\nAll ratings smashes. All decided in 60% of the format's allotted time.",
      "Where Bazball didn't win: against the best, away from home.\nEngland have won a single Test in India since 2022 but lost the series.\nThey have not played a four-Test rubber away and won.\nThe 2023 Ashes ended 2-2 — but England were the worse team for most of the summer.",
      "None of which is a critique of Stokes himself.\nThe captaincy is the cleanest example in modern Test cricket of a coach and captain agreeing on a single principle and never blinking.\nEvery decision designed to refuse a draw. Draws teach you nothing.",
      "That is the Bazball trade.\nPerformance in the moment is no longer separate from performance in the result.\nMcCullum did not need cricket to start scoring runs. He needed cricket to start being watchable again.\nThree years in, that part is fully delivered.",
      "What it has NOT proved: that this team is the best in the world.\nThe 2027 winter — India and Australia, on pitches that don't reward English seamers — is the real exam.\nUntil then, the verdict is half right. A revolution at home. A question mark abroad.\nFull breakdown 👇",
    ].join("\n\n"),
    twitterImageMap: [
      { tweetIndex: 0, svgIndex: 0, alt: "England Test run rate 2010-2026 — visible step-change at McCullum's hiring in 2022" },
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
