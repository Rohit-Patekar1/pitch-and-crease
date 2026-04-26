/**
 * scripts/generate.ts
 *
 * Direct one-shot generator (no queue). Spawns Claude Code with your Max
 * subscription and creates either an Article or a SocialPost as a DRAFT.
 *
 * Usage:
 *   npm run generate -- --type=article --slot=on-this-day
 *   npm run generate -- --type=social --slot=on-this-day
 *   npm run generate -- --type=article --slot=custom --custom="your prompt"
 *   npm run generate -- --daily        # one of each across all slots
 */
import { spawn } from "node:child_process";
import { readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient, type Sport, type SocialType } from "@prisma/client";
import {
  buildArticlePrompt,
  buildSocialPrompt,
  type ArticleSlot,
  type SocialSlot,
} from "../src/lib/generate-prompt";
import { renderSvgsFromHtml } from "../src/lib/render-svg";

const prisma = new PrismaClient();

const ARTICLE_SLOTS: ArticleSlot[] = ["on-this-day", "recent-match", "transfer", "tactics", "player"];
const SOCIAL_SLOTS: SocialSlot[] = ["on-this-day", "stat-moment", "quick-take", "transfer-flash"];

function parseArgs() {
  const args = process.argv.slice(2);
  const type = (args.find((a) => a.startsWith("--type="))?.split("=")[1] ?? "article") as
    | "article"
    | "social";
  const slot = args.find((a) => a.startsWith("--slot="))?.split("=")[1];
  const custom = args.find((a) => a.startsWith("--custom="))?.split("=")[1];
  const daily = args.includes("--daily");
  return { type, slot, custom, daily };
}

function runClaude(prompt: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[generate] invoking Claude CLI...`);
    const proc = spawn("claude", ["-p", prompt], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } });
    let stderr = "";
    proc.stdout.on("data", () => process.stdout.write("."));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      process.stdout.write("\n");
      if (code === 0 && existsSync(outPath)) resolve();
      else reject(new Error(`claude exited ${code}; stderr: ${stderr.slice(-300)}`));
    });
    proc.on("error", reject);
  });
}

function extractJson<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

async function generateArticle(slot: ArticleSlot, custom?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-articles");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const out = join(tmpDir, `article-${Date.now()}.json`);

  const prompt =
    slot === "custom"
      ? buildArticlePrompt("custom", custom!, today, out)
      : buildArticlePrompt(slot, undefined, today, out);
  await runClaude(prompt, out);
  const a = extractJson<{
    sport: Sport;
    title: string;
    slug: string;
    dek: string;
    body: string;
    promoTweet?: string;
    promoImageSvgIndex?: number;
  }>(readFileSync(out, "utf-8"));

  for (const k of ["title", "slug", "dek", "body"] as const) {
    if (!a[k] || typeof a[k] !== "string") throw new Error(`missing field: ${k}`);
  }
  a.sport = String(a.sport ?? "FOOTBALL").toUpperCase() as Sport;
  if (a.sport !== "FOOTBALL" && a.sport !== "CRICKET") a.sport = "FOOTBALL";
  let slug = String(a.slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${today}`;

  const rendered = renderSvgsFromHtml(a.body);
  const idx = a.promoImageSvgIndex ?? 0;
  const heroSvg = rendered.find((r) => r.index === idx) ?? rendered[0];
  const promoImage = heroSvg ? { alt: heroSvg.alt, base64: heroSvg.base64 } : null;

  const created = await prisma.article.create({
    data: {
      slug,
      sport: a.sport,
      title: a.title,
      dek: a.dek,
      body: a.body,
      promoTweet: a.promoTweet ?? null,
      promoImage: (promoImage as object) ?? undefined,
      status: "DRAFT",
      source: slot,
      promptSeed: (custom ?? slot).slice(0, 500),
    },
  });
  try { unlinkSync(out); } catch { /* ignore */ }
  console.log(`[generate] ✓ article ${created.id} — ${created.title}`);
}

async function generateSocial(slot: SocialSlot, custom?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-social");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const out = join(tmpDir, `social-${Date.now()}.json`);

  const prompt =
    slot === "custom"
      ? buildSocialPrompt("custom", custom!, today, out)
      : buildSocialPrompt(slot, undefined, today, out);
  await runClaude(prompt, out);
  const s = extractJson<{
    sport: Sport;
    type: SocialType;
    title: string;
    tweetText: string;
  }>(readFileSync(out, "utf-8"));

  if (!s.tweetText || !s.title) throw new Error("missing required fields");
  s.sport = String(s.sport ?? "FOOTBALL").toUpperCase() as Sport;
  if (s.sport !== "FOOTBALL" && s.sport !== "CRICKET") s.sport = "FOOTBALL";
  const validTypes = ["ON_THIS_DAY", "STAT_MOMENT", "QUICK_TAKE", "TRANSFER_FLASH", "OTHER"] as const;
  const type = (validTypes as readonly string[]).includes(s.type) ? s.type : "OTHER";

  const created = await prisma.socialPost.create({
    data: {
      sport: s.sport,
      type: type as SocialType,
      title: s.title,
      tweetText: s.tweetText,
      status: "DRAFT",
      source: slot,
      promptSeed: (custom ?? slot).slice(0, 500),
    },
  });
  try { unlinkSync(out); } catch { /* ignore */ }
  console.log(`[generate] ✓ social ${created.id} — ${created.title}`);
}

async function main() {
  const { type, slot, custom, daily } = parseArgs();

  if (daily) {
    for (const s of ARTICLE_SLOTS) {
      try { await generateArticle(s); }
      catch (e) { console.error(`[generate] article ${s} failed:`, e); }
    }
    for (const s of SOCIAL_SLOTS) {
      try { await generateSocial(s); }
      catch (e) { console.error(`[generate] social ${s} failed:`, e); }
    }
    return;
  }

  if (!slot) {
    console.error("Usage: --type=article|social --slot=<slot>  or  --daily");
    process.exit(1);
  }

  if (type === "article") {
    if (slot === "custom" && !custom) {
      console.error("--custom='prompt' required for custom article slot");
      process.exit(1);
    }
    await generateArticle(slot as ArticleSlot, custom);
  } else if (type === "social") {
    if (slot === "custom" && !custom) {
      console.error("--custom='prompt' required for custom social slot");
      process.exit(1);
    }
    await generateSocial(slot as SocialSlot, custom);
  } else {
    console.error("--type must be 'article' or 'social'");
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
