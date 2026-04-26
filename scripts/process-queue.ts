/**
 * scripts/process-queue.ts
 *
 * Polls the GenerationRequest table for PENDING items and processes them with
 * the local Claude Code CLI (using your Max subscription — no API credits).
 *
 * Usage:
 *   npm run process:queue                  # process all currently pending, then exit
 *   npm run process:queue -- --watch       # poll every 60s and process forever
 *   npm run process:queue -- --interval=15 # custom poll interval in seconds
 *
 * Run from your laptop. Requires:
 *   - DATABASE_URL pointing at the live (Railway) Postgres
 *   - claude CLI installed and logged in
 */
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient, type Sport } from "@prisma/client";
import { buildPrompt, type Slot } from "../src/lib/generate-prompt";
import { renderSvgsFromHtml } from "../src/lib/render-svg";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch");
  const intervalArg = args.find((a) => a.startsWith("--interval="))?.split("=")[1];
  const intervalSeconds = intervalArg ? Number(intervalArg) : 60;
  return { watch, intervalSeconds };
}

function runClaude(prompt: string, articlePath: string): Promise<void> {
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
      if (code === 0 && existsSync(articlePath)) {
        resolve();
      } else {
        reject(new Error(`claude exited ${code}; stderr: ${stderr.slice(-300)}`));
      }
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
  twitterThread?: string;
  twitterImageMap?: Array<{ tweetIndex: number; svgIndex: number; alt?: string }>;
}

function extractArticleJson(raw: string): ParsedArticle {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const obj = JSON.parse(cleaned);
  for (const k of ["title", "slug", "dek", "body"]) {
    if (!obj[k] || typeof obj[k] !== "string") {
      throw new Error(`generated JSON missing or invalid field: ${k}`);
    }
  }
  obj.sport = String(obj.sport ?? "FOOTBALL").toUpperCase() as Sport;
  if (obj.sport !== "FOOTBALL" && obj.sport !== "CRICKET") obj.sport = "FOOTBALL";
  obj.slug = String(obj.slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return obj as ParsedArticle;
}

function buildTweetImages(
  body: string,
  imageMap: ParsedArticle["twitterImageMap"],
): Array<{ slot: number; alt: string; base64: string }> {
  if (!imageMap || imageMap.length === 0) return [];
  const rendered = renderSvgsFromHtml(body);
  const out: Array<{ slot: number; alt: string; base64: string }> = [];
  for (const m of imageMap) {
    const png = rendered.find((r) => r.index === m.svgIndex);
    if (!png) continue;
    out.push({ slot: m.tweetIndex, alt: m.alt ?? png.alt, base64: png.base64 });
  }
  return out;
}

async function processOne(req: {
  id: string;
  prompt: string;
  slot: string;
}): Promise<void> {
  console.log(`[queue] processing #${req.id} slot=${req.slot}`);
  await prisma.generationRequest.update({
    where: { id: req.id },
    data: { status: "PROCESSING" },
  });

  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-articles");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const articlePath = join(tmpDir, `article-${Date.now()}.json`);

  const slot = req.slot as Slot;
  const prompt =
    slot === "custom"
      ? buildPrompt("custom", req.prompt, today, articlePath)
      : buildPrompt(slot, undefined, today, articlePath);

  try {
    await runClaude(prompt, articlePath);
    const raw = readFileSync(articlePath, "utf-8");
    const article = extractArticleJson(raw);

    let slug = article.slug;
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${today}`;

    const tweetImages = buildTweetImages(article.body, article.twitterImageMap);
    console.log(`[queue] rendered ${tweetImages.length} thread images`);

    const created = await prisma.article.create({
      data: {
        slug,
        sport: article.sport,
        title: article.title,
        dek: article.dek,
        body: article.body,
        twitterThread: article.twitterThread ?? null,
        tweetImages: tweetImages.length > 0 ? (tweetImages as object) : undefined,
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
    console.log(`[queue] ✓ #${req.id} -> article ${created.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[queue] ✗ #${req.id} failed:`, msg);
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
  if (pending.length === 0) return 0;
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
      if (n === 0) {
        await new Promise((r) => setTimeout(r, intervalSeconds * 1000));
      }
    }
  } else {
    const n = await processBatch();
    if (n === 0) {
      console.log("[queue] no pending requests.");
    } else {
      console.log(`[queue] processed ${n} request(s).`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
