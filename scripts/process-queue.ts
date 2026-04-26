/**
 * scripts/process-queue.ts
 *
 * Polls GenerationRequest for PENDING items and processes them.
 * Branches on contentType: ARTICLE produces an Article + promo image,
 * SOCIAL produces a SocialPost.
 *
 * Usage:
 *   npm run process:queue                  # one pass, exit
 *   npm run process:queue -- --watch       # poll forever (~60s)
 */
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
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

function parseArgs() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch");
  const intervalArg = args.find((a) => a.startsWith("--interval="))?.split("=")[1];
  const intervalSeconds = intervalArg ? Number(intervalArg) : 60;
  return { watch, intervalSeconds };
}

function runClaude(prompt: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stderr = "";
    proc.stdout.on("data", () => process.stdout.write("."));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      process.stdout.write("\n");
      if (code === 0 && existsSync(outputPath)) resolve();
      else reject(new Error(`claude exited ${code}; stderr: ${stderr.slice(-300)}`));
    });
    proc.on("error", reject);
  });
}

interface ParsedArticle {
  sport: Sport;
  title: string;
  slug: string;
  dek: string;
  body: string;
  promoTweet?: string;
  promoImageSvgIndex?: number;
}

interface ParsedSocial {
  sport: Sport;
  type: SocialType;
  title: string;
  tweetText: string;
  imageHint?: string | null;
}

function extractJson<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

async function processArticle(req: { id: string; prompt: string; slot: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-articles");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const articlePath = join(tmpDir, `article-${Date.now()}.json`);

  const slot = req.slot as ArticleSlot;
  const prompt =
    slot === "custom"
      ? buildArticlePrompt("custom", req.prompt, today, articlePath)
      : buildArticlePrompt(slot, undefined, today, articlePath);

  await runClaude(prompt, articlePath);
  const raw = readFileSync(articlePath, "utf-8");
  const a = extractJson<ParsedArticle>(raw);

  for (const k of ["title", "slug", "dek", "body"] as const) {
    if (!a[k] || typeof a[k] !== "string") throw new Error(`missing field: ${k}`);
  }
  a.sport = String(a.sport ?? "FOOTBALL").toUpperCase() as Sport;
  if (a.sport !== "FOOTBALL" && a.sport !== "CRICKET") a.sport = "FOOTBALL";
  a.slug = String(a.slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  let slug = a.slug;
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${today}`;

  // Render the chosen SVG as a single promo image
  const rendered = renderSvgsFromHtml(a.body);
  const idx = a.promoImageSvgIndex ?? 0;
  const heroSvg = rendered.find((r) => r.index === idx) ?? rendered[0];
  const promoImage = heroSvg
    ? { alt: heroSvg.alt, base64: heroSvg.base64 }
    : null;

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
      source: req.slot,
      promptSeed: req.prompt.slice(0, 500),
    },
  });

  await prisma.generationRequest.update({
    where: { id: req.id },
    data: { status: "DONE", articleId: created.id },
  });
  try {
    unlinkSync(articlePath);
  } catch {
    /* ignore */
  }
  console.log(`[queue] ✓ article ${created.id}`);
}

async function processSocial(req: { id: string; prompt: string; slot: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-social");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const outputPath = join(tmpDir, `social-${Date.now()}.json`);

  const slot = req.slot as SocialSlot;
  const prompt =
    slot === "custom"
      ? buildSocialPrompt("custom", req.prompt, today, outputPath)
      : buildSocialPrompt(slot, undefined, today, outputPath);

  await runClaude(prompt, outputPath);
  const raw = readFileSync(outputPath, "utf-8");
  const s = extractJson<ParsedSocial>(raw);

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
      source: req.slot,
      promptSeed: req.prompt.slice(0, 500),
    },
  });

  await prisma.generationRequest.update({
    where: { id: req.id },
    data: { status: "DONE", socialPostId: created.id },
  });
  try {
    unlinkSync(outputPath);
  } catch {
    /* ignore */
  }
  console.log(`[queue] ✓ social ${created.id}`);
}

async function processOne(req: {
  id: string;
  contentType: "ARTICLE" | "SOCIAL";
  prompt: string;
  slot: string;
}) {
  console.log(`[queue] processing ${req.id} ${req.contentType}/${req.slot}`);
  await prisma.generationRequest.update({
    where: { id: req.id },
    data: { status: "PROCESSING" },
  });
  try {
    if (req.contentType === "ARTICLE") await processArticle(req);
    else await processSocial(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[queue] ✗ ${req.id} failed:`, msg);
    await prisma.generationRequest.update({
      where: { id: req.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 2000) },
    });
  }
}

async function processBatch(): Promise<number> {
  const pending = await prisma.generationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const req of pending) {
    await processOne(req);
  }
  return pending.length;
}

async function main() {
  const { watch, intervalSeconds } = parseArgs();
  if (watch) {
    console.log(`[queue] watch mode, polling every ${intervalSeconds}s. Ctrl+C to stop.`);
    while (true) {
      const n = await processBatch();
      if (n === 0) await new Promise((r) => setTimeout(r, intervalSeconds * 1000));
    }
  } else {
    const n = await processBatch();
    if (n === 0) console.log("[queue] no pending requests.");
    else console.log(`[queue] processed ${n} request(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
