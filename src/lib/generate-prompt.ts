/**
 * Prompt builders for the two generation modes:
 *  - article: full long-form piece on the website + ONE promotional tweet
 *  - social:  Twitter-native short post (no website article)
 */

export type ArticleSlot =
  | "on-this-day"
  | "recent-match"
  | "transfer"
  | "tactics"
  | "player"
  | "custom";

export type SocialSlot =
  | "on-this-day"
  | "stat-moment"
  | "quick-take"
  | "transfer-flash"
  | "custom";

// ---------- ARTICLE ----------

export const ARTICLE_SLOT_BRIEFS: Record<Exclude<ArticleSlot, "custom">, string> = {
  "on-this-day": `Find ONE notable football event that happened on this date in history. Pick something with rich tactical or narrative material. Write about it as if it just happened.`,
  "recent-match": `Find ONE notable football match that concluded in the last 48 hours from a top-5 European league or UCL/UEL knockout. Use web search for the result, lineups, scorers, and key stats. Write a tactical analysis.`,
  "transfer": `Find ONE significant transfer story from the last 7 days affecting a top-20 European club. Write an analytical piece on the player, fit, price, and implications.`,
  "tactics": `Pick ONE tactical theme being actively discussed in football right now. Write a deep-dive with concrete examples — at least two clubs/players exemplifying it.`,
  "player": `Pick ONE in-form player from a top-5 European league. Write a profile covering season, role, tactical strengths, statistical edges.`,
};

const ARTICLE_GUIDE = `
You are writing for "Pitch and Crease," a daily tactical analysis publication. Match the editorial tone of The Athletic, Tifo Football, and StatsBomb — analytical, decisive, original, never aggregated.

REQUIRED OUTPUT — single JSON object written to the file path provided:

{
  "sport": "FOOTBALL",
  "title": string,                // editorial title, max 90 chars
  "slug": string,                 // kebab-case, ASCII only
  "dek": string,                  // single-sentence subheadline, 80-200 chars
  "body": string,                 // full HTML body (see structure below)
  "promoTweet": string,           // SINGLE tweet (max 220 chars; URL appended automatically)
  "promoImageSvgIndex": number    // 0-based index of which body <svg> to render as the promo image (typically 0 — the formation diagram or hero stat card)
}

After writing the file, output ONLY the literal text "DONE" to stdout.

PROMOTIONAL TWEET
=================
ONE tweet, 180-220 chars max. Goal: hook the reader, deliver one striking stat or contradiction, and make them want to click through to read the full piece. The article URL gets appended automatically — do NOT include any URL in the tweet text.

Good examples:
- "Atlético Madrid 1-2 Barcelona. Aggregate 3-2.\\nThey had 28.9% of the ball. They took one chance worth its xG.\\nHow Diego Simeone strangled the comeback — and why this is the entire Atlético project."
- "Bazball, three years in.\\nEngland's Test run rate: 4.74 — the highest sustained tempo any side has produced.\\nW-L: 22-13.\\nDid the experiment actually work? The data says yes, no, and it depends."

Rules:
1. NO hashtags. NO @mentions. NO emojis except occasionally 🧵 or 👇 if it earns its place.
2. Lead with a stat, a result, or a contradiction. Never lead with "In this piece" or "I argue."
3. End with a question, a thesis, or a teaser line that makes clicking inevitable.
4. ONE single tweet. NOT a thread. Don't separate into multiple lines with blank-line breaks.

BODY CONTENT
============
1100-1600 words of original analysis. Single <style> block scoped to .article-body. All inside one <div class="article-body">.

Color theme — set these CSS variables on .article-body:
  --bg: #0b0e14;
  --panel: #131822;
  --panel-2: #1a2030;
  --ink: #f1f3f7;
  --ink-dim: #aab2c0;
  --line: #232a3a;
  --gold: #f7c948;
  --primary: <choose a team color, e.g. #cb3524>;

REQUIRED STRUCTURE:
1. KICKER (small uppercase label)
2. H1 TITLE
3. DEK paragraph
4. META row with date and venue
5. For matches: a SCORE CARD with crests/score/scorers
6. KINETIC STAT STRIP (4 cards with big numbers)
7. AT LEAST 3 SECTIONS with H2 headings, 2-4 paragraphs each
8. AT LEAST 2 ORIGINAL SVG VISUALS — formation diagram, tactical pitch, xG flow, shot map, possession bar, player ratings
9. CLOSING "What it means" / "Verdict" section
10. SOURCES section as <ul> with full URLs

SVG TIPS
- viewBox like "0 0 760 480" with dark green pitch backgrounds
- Always include xmlns="http://www.w3.org/2000/svg" and any <defs> the SVG references
- Stroke="rgba(255,255,255,0.55)" stroke-width="2" for pitch lines

Cite real, verifiable facts only. Use web search to confirm before writing. Tone: confident, decisive, no hedging.
`;

export function buildArticlePrompt(
  slot: ArticleSlot,
  customBrief: string | undefined,
  today: string,
  articlePath: string,
): string {
  const brief = slot === "custom" ? customBrief! : ARTICLE_SLOT_BRIEFS[slot];
  return `Today is ${today}.

Slot: article · ${slot}

Brief:
${brief}

Write the article JSON to this file path: ${articlePath}

${ARTICLE_GUIDE}`;
}

// ---------- SOCIAL ----------

export const SOCIAL_SLOT_BRIEFS: Record<Exclude<SocialSlot, "custom">, string> = {
  "on-this-day": `Find ONE notable football event from this date in history. Write a 1-3 tweet "On this day" social post.`,
  "stat-moment": `Pick ONE striking football statistic that's been talked about this week. Write a 1-2 tweet share with the stat front-and-center.`,
  "quick-take": `Pick ONE thing happening in football right now and write a 1-2 tweet take that lands a clear opinion.`,
  "transfer-flash": `Find ONE breaking transfer story from the last 24 hours. Write a 1-2 tweet flash with the key details.`,
};

const SOCIAL_GUIDE = `
You are writing for "Pitch and Crease" — a Twitter-native short football post. NO website article behind it. The whole post lives on X.

REQUIRED OUTPUT — single JSON object written to the file path provided:

{
  "sport": "FOOTBALL",
  "type": "ON_THIS_DAY" | "STAT_MOMENT" | "QUICK_TAKE" | "TRANSFER_FLASH" | "OTHER",
  "title": string,                  // INTERNAL admin name (NOT shown on X), max 80 chars
  "tweetText": string,              // 1-3 tweets separated by BLANK LINES (\\n\\n between tweets)
  "imageHint": string | null        // optional 1-line description if a visual would help (e.g. "wagon-wheel showing Lara's 400 shot zones")
}

After writing the file, output ONLY the literal text "DONE" to stdout.

TWEET RULES
1. Each tweet ≤ 270 chars.
2. 1 tweet for stat-moment / quick-take / transfer-flash; up to 3 for on-this-day.
3. Lead with the hook — a date, a stat, a result. Never preamble.
4. NO hashtags. NO @mentions. NO emojis except occasional contextual ones (🧵 only for actual threads ≥2 tweets).
5. End the LAST tweet with the punchline, a question, or a teaser. No CTA URLs (this is X-native, no website link).
6. Match this voice — short, specific, factual, slightly cheeky:

Examples (one-tweet 'on this day'):
- "On this day in 2010, Diego Forlán scored a 30-yard volley vs Germany at the World Cup. He won the Golden Ball that summer. He never scored a single Premier League goal at Manchester United.\\n\\nFootball balances itself."

Examples (multi-tweet 'on this day'):
- Tweet 1: "On this day in 2014, Diego Costa joined Chelsea for £32m.\\n\\nHe scored on his debut. He scored 20 in his first season. Won the league. Started the title race that ended with the Mourinho meltdown.\\n\\nThe best transfer of the era. 👇"
- Tweet 2: "Three Premier League titles in his career. All three for Chelsea, all three within five years.\\n\\nRetired at 35 with a Europa League and a La Liga to his name on top.\\n\\nYou could argue no signing of the last decade returned more for less."

Examples (stat-moment, 1 tweet):
- "Real Madrid have scored from a corner in 11 of their last 12 matches.\\n\\nSecond-most prolific set-piece team in Europe behind Arsenal. Different shape — RM kick to the near post, Arsenal load the back. Both teams modeling on Brentford's '21 setup."

Cite real, verifiable facts only. Use web search to confirm dates, stats, and details. If you can't verify, skip and pick a different angle.
`;

export function buildSocialPrompt(
  slot: SocialSlot,
  customBrief: string | undefined,
  today: string,
  outputPath: string,
): string {
  const brief = slot === "custom" ? customBrief! : SOCIAL_SLOT_BRIEFS[slot];
  return `Today is ${today}.

Slot: social · ${slot}

Brief:
${brief}

Write the JSON to this file path: ${outputPath}

${SOCIAL_GUIDE}`;
}
