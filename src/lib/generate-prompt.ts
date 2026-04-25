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
  "sport": "FOOTBALL"            // always FOOTBALL for now
  "title": string,                // punchy editorial title, max 90 chars
  "slug": string,                 // kebab-case-slug-of-title, ASCII only
  "dek": string,                  // single-sentence subheadline, 80-200 chars
  "body": string                  // the full HTML body, see below
}

After writing the file, output ONLY the literal text "DONE" to stdout. No commentary, no preamble.

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
8. AT LEAST 2 ORIGINAL SVG VISUALS — pick from:
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
