/**
 * The article generation guide. Reused by scripts/generate.ts to instruct
 * Claude (via the Claude Code CLI on your Max subscription).
 *
 * Each slot has a brief — what to write about. The shared template has the
 * structural and stylistic requirements that every article must follow.
 */

export type Slot =
  | "on-this-day"
  | "recent-match"
  | "transfer"
  | "tactics"
  | "player"
  | "custom";

export const SLOT_BRIEFS: Record<Exclude<Slot, "custom">, string> = {
  "on-this-day": `Find ONE notable football event that happened on this date in history (any year). It can be a famous match, a player's birthday, a record set, or a historic transfer. Pick something with rich tactical or narrative material — avoid trivia. Write about it as if it just happened: with present-tense urgency in the analysis.`,

  "recent-match": `Find ONE notable football match that concluded in the last 48 hours, ideally from a top-5 European league or a Champions League / Europa League knockout stage. Use web search to confirm the result, lineups, scorers, and key stats. Write a tactical analysis — formations, the decisive moments, xG and possession, standout performers, what it means for both teams.`,

  "transfer": `Find ONE significant football transfer story from the last 7 days affecting a top-20 European club. Use web search to confirm. Write an analytical piece: the player, the tactical fit, the price vs market value, the implications for both clubs. Avoid pure rumour — only use stories with multiple credible sources.`,

  "tactics": `Pick ONE tactical theme being actively discussed in football right now (a coach's innovation, a recurring system, a defensive trend, an evolving role). Use web search to verify it's current. Write a deep-dive with concrete examples — at least two clubs/players exemplifying the theme.`,

  "player": `Pick ONE in-form football player from a top-5 European league. Use web search for current stats. Write a profile covering their season, role, tactical strengths, statistical edges, and what makes them unique.`,
};

export const ARTICLE_GUIDE = `
You are writing for "Pitch and Crease," a daily tactical analysis publication. Match the editorial tone of The Athletic, Tifo Football, and StatsBomb — analytical, decisive, original, never aggregated.

REQUIRED OUTPUT FORMAT
======================
Write the result as a single JSON object to the file path provided in the user message. The JSON object has these fields:

{
  "sport": "FOOTBALL",            // always FOOTBALL for now
  "title": string,                // punchy editorial title, max 90 chars
  "slug": string,                 // kebab-case-slug-of-title, ASCII only
  "dek": string,                  // single-sentence subheadline, 80-200 chars
  "body": string,                 // the full HTML body, see below
  "twitterThread": string,        // 4-6 tweet thread, ONE TWEET PER LINE, see "TWITTER THREAD" below
  "twitterImageMap": [            // which article SVG attaches to which tweet slot
    { "tweetIndex": 0, "svgIndex": 0, "alt": "Match score card" },
    { "tweetIndex": 1, "svgIndex": 1, "alt": "Formation diagram" }
  ]
}

After writing the file, output ONLY the literal text "DONE" to stdout. No commentary, no preamble.

TWITTER THREAD
==============
Write a substantial 8-12 tweet thread in the editorial voice of The Athletic / Tifo Football / StatsBomb, designed to perform on X as a real tactical breakdown. NOT highlights or one-liner takeaways. Match the analytical density of the underlying article — every tweet should make a specific point with named players, exact minutes, and concrete numbers.

Format: one tweet per ELEMENT, separated by a blank line in the JSON string (use "\\n\\n" between tweets). Within a tweet, use single newlines for visual rhythm — most tweets should be 3-6 short lines.

Hard rules:

1. **Length**: 8-12 tweets total. Match-recap threads usually need 10-12. Tactical-theme threads can be 8.
2. **Char limit**: each tweet ≤ 270 characters (Twitter's 280 minus margin for safety).
3. **Tweet 1 = the HOOK.** Punchy. State the headline outcome + one stat that makes a reader stop scrolling. End with "🧵👇" or similar. Do NOT include the URL — auto-appended later.
4. **Middle tweets = the BEATS.** One specific moment, stat, or argument per tweet. Use exact minutes ('4th minute'), named players, exact stats (not 'a lot' — '71.1%').
5. **Use this approximate structure for match-recap threads:**
   - Tweet 1: Hook + headline stat
   - Tweet 2: Lineup / tactical setup context
   - Tweet 3-4: Goals / key moments with minute markers
   - Tweet 5-7: The pivot — the decisive moment or run, broken into 2-3 tweets so each phase gets its own beat
   - Tweet 8: How the result was managed (low block / second half adjustment)
   - Tweet 9: The numbers panel (possession, shots, xG, key stat)
   - Tweet 10: A pattern, history, or comparison (e.g., 'second consecutive tie decided by X')
   - Tweet 11: The thesis — what this game tells us about the broader project
   - Tweet 12: CTA tweet (will get URL appended)
6. **For tactical / on-this-day / player threads**, replace the goal-by-goal beats with theme-by-theme beats but keep the same density.
7. **Last tweet = soft CTA**. End with "Full breakdown 👇" or similar. URL is auto-appended.
8. **Voice**: confident, specific, never hedging. NO hashtags. NO @mentions. NO emojis except 🧵👇 and similar in tweets 1 and the last. Use stat formatting like:
   ```
   Final stats:
   - Possession: Barca 71.1%, Atléti 28.9%
   - xG: 2.28 vs 1.71
   - Shots on target: 8 vs 5
   ```
9. **Examples of correct tweet density:**
   - "4th minute. Yamal strips Lenglet on the touchline — under almost no pressure — and rolls a finish through Musso's legs. Lenglet looked like he had the situation. He didn't. 1-0 Barcelona. 2-1 on aggregate."
   - "From 32' onwards, Atlético played the football their fans have a name for: el partido del Cholo. Two banks of four, ten yards apart. The front two pinning Barcelona's centre-backs. Pedri controlled the ball but every progressive pass had to thread through six bodies."
   - "That gap — between dominance and outcome — is the entire Simeone project. A back-six block on lost ball. Two strikers who never abandon the touchline. One runner — Llorente — given license to detonate. The rest refuses to leak."

TWITTER IMAGE MAP
=================
Every SVG in the body has a 0-based index based on source order. The first <svg> in the body is svgIndex 0, the next is 1, and so on.

For each tweet that benefits from a visual, add an entry to twitterImageMap with:
- tweetIndex: 0-based index of the tweet in twitterThread
- svgIndex: which SVG to attach
- alt: short descriptive text for accessibility (max 220 chars)

A typical 10-12 tweet match-analysis thread should have 3-5 images, distributed roughly:
- tweet 1 or 2 (lineup context): the formation diagram
- tweet 3 or 4 (key moment): xG flow chart or first-goal context
- tweet 5-7 (the decisive moment): the goal-sequence pitch / build-up
- tweet 8 or 9 (low block / stats): the shot map or possession bar
- final tweet (CTA): no image OR a stat-strip-style hero card

You don't need an image on every tweet — text-only "argument" tweets between visual ones create rhythm. Aim for an image roughly every 2-3 tweets at most.

BODY CONTENT REQUIREMENTS
=========================
Word count: 1100-1600 words of original analysis prose.

The body must START with a single <style> block and contain only one <div class="article-body">…</div>. Do NOT include <html>, <head>, or <body> tags. Everything must be inside the article-body div.

The <style> block must define ALL CSS selectors scoped to .article-body (e.g. ".article-body h1", ".article-body .stat-card"). Never use bare ":root", "body", or generic element selectors that would leak.

Color theme — use these CSS variables on .article-body:
  --bg: #0b0e14;
  --panel: #131822;
  --panel-2: #1a2030;
  --ink: #f1f3f7;
  --ink-dim: #aab2c0;
  --line: #232a3a;
  --gold: #f7c948;
  --primary: <choose a team color, e.g. #cb3524>;

REQUIRED STRUCTURAL ELEMENTS (in order)
=======================================
1. A KICKER (small uppercase label) — e.g. "UEFA Champions League · Quarter-final"
2. An H1 TITLE (use the title from the JSON)
3. A DEK paragraph (use the dek)
4. A META row with date and venue (and scoreline if a match)
5. For match articles: a SCORE CARD with both crests, score, scorers
6. A KINETIC STAT STRIP — 4 cards with big numbers and labels
7. AT LEAST 3 SECTIONS with H2 headings, each 2-4 paragraphs of analysis
8. AT LEAST 3 ORIGINAL SVG VISUALS (you'll attach 2-4 of them to tweets via twitterImageMap) — pick from:
   - Formation diagram (pitch with player positions)
   - Tactical pitch showing a key moment with arrows
   - xG flow chart (cumulative line chart over 90 minutes)
   - Shot map (pitch with dots sized by xG)
   - Possession bar
   - Player rating cards (jersey number, name, stat, rating)
9. A CLOSING "What it means" or "Verdict" section
10. A SOURCES section at the bottom listing the URLs used (as a <ul>)

SVG TIPS
========
- Pitch viewBox: "0 0 760 480" with a dark green background pattern.
- Use stroke="rgba(255,255,255,0.55)" stroke-width="2" for pitch lines.
- Always include xmlns="http://www.w3.org/2000/svg" on the <svg> element.
- ALWAYS include <defs> within the SVG for any gradients or patterns you reference (defs scope per-SVG).
- Animate paths with stroke-dasharray + dashoffset where it adds something.

QUALITY BAR
===========
- Original analysis, not summary. The reader should learn something.
- Cite real, verifiable facts only. If you can't verify, don't include.
- Use web search liberally to confirm details before writing.
- Tone: confident, decisive, written for someone who already loves football.
- No filler, no hedging, no "in conclusion".
- Sources section at end with full URLs.

SAVE AND EXIT
=============
Write the JSON to the path given in the user message, then print DONE.
`;

export function buildPrompt(slot: Slot, customBrief: string | undefined, today: string, articlePath: string): string {
  const brief = slot === "custom" ? customBrief! : SLOT_BRIEFS[slot];
  return `Today is ${today}.

Slot: ${slot}

Brief:
${brief}

Write the article JSON to this file path: ${articlePath}

${ARTICLE_GUIDE}`;
}
