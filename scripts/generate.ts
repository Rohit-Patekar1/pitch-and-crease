/**
 * scripts/generate.ts
 *
 * Generates an article using Claude Code on your Max subscription
 * (no API credits needed). Spawns the `claude` CLI as a subprocess,
 * has it write the article JSON to a file, then loads it into Postgres
 * as a DRAFT for you to review in the admin dashboard.
 *
 * Usage:
 *   npm run generate -- --slot=on-this-day
 *   npm run generate -- --slot=recent-match
 *   npm run generate -- --slot=custom --custom="Tactical look at De Zerbi at Marseille this season"
 *   npm run generate -- --daily        # runs all 5 slots back-to-back
 *
 * Prerequisites:
 *   - Claude Code CLI installed and logged in (`claude /login`)
 *   - DATABASE_URL set in .env (Railway Postgres or local)
 */
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient, Sport, Status } from "@prisma/client";
import { buildPrompt, type Slot } from "../src/lib/generate-prompt";

const prisma = new PrismaClient();

const SLOTS: Slot[] = ["on-this-day", "recent-match", "transfer", "tactics", "player"];

function parseArgs() {
  const args = process.argv.slice(2);
  const slot = args.find((a) => a.startsWith("--slot="))?.split("=")[1] as Slot | undefined;
  const custom = args.find((a) => a.startsWith("--custom="))?.split("=")[1];
  const daily = args.includes("--daily");
  return { slot, custom, daily };
}

function runClaude(prompt: string, articlePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[generate] invoking Claude CLI (this may take 60-180 seconds)...`);
    const proc = spawn("claude", ["-p", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      const chunk = d.toString();
      stdout += chunk;
      // Stream a heartbeat
      process.stdout.write(".");
    });
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      process.stdout.write("\n");
      if (code === 0) {
        if (existsSync(articlePath)) {
          resolve();
        } else {
          reject(
            new Error(
              `Claude exited 0 but did not write ${articlePath}.\n` +
                `Last 500 chars of stdout:\n${stdout.slice(-500)}`,
            ),
          );
        }
      } else {
        reject(new Error(`claude exited ${code}.\nstderr:\n${stderr.slice(-500)}`));
      }
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn 'claude' CLI: ${err.message}\n\n` +
            `Make sure Claude Code is installed and logged in:\n` +
            `  curl -fsSL https://claude.ai/install.sh | bash\n` +
            `  claude /login`,
        ),
      );
    });
  });
}

function extractArticleJson(raw: string): {
  sport: Sport;
  title: string;
  slug: string;
  dek: string;
  body: string;
} {
  // Strip code fences if Claude added them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const obj = JSON.parse(cleaned);
  const required = ["sport", "title", "slug", "dek", "body"];
  for (const k of required) {
    if (!obj[k] || typeof obj[k] !== "string") {
      throw new Error(`generated JSON missing or invalid field: ${k}`);
    }
  }
  // Normalize sport
  obj.sport = String(obj.sport).toUpperCase() as Sport;
  if (obj.sport !== "FOOTBALL" && obj.sport !== "CRICKET") {
    obj.sport = "FOOTBALL";
  }
  // Slugify defensively
  obj.slug = obj.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return obj;
}

async function generate(slot: Slot, custom?: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const tmpDir = join(tmpdir(), "pc-articles");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const articlePath = join(tmpDir, `article-${Date.now()}.json`);

  const prompt = buildPrompt(slot, custom, today, articlePath);

  console.log(`[generate] slot=${slot}${custom ? ` custom="${custom.slice(0, 60)}..."` : ""}`);
  console.log(`[generate] target file: ${articlePath}`);

  await runClaude(prompt, articlePath);

  const raw = readFileSync(articlePath, "utf-8");
  const article = extractArticleJson(raw);

  // De-duplicate slugs by appending a date suffix on collision
  let slug = article.slug;
  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${today}`;
    console.log(`[generate] slug collision, using: ${slug}`);
  }

  const created = await prisma.article.create({
    data: {
      slug,
      sport: article.sport,
      title: article.title,
      dek: article.dek,
      body: article.body,
      status: "DRAFT",
      source: slot,
      promptSeed: (custom ?? slot).slice(0, 500),
    },
  });

  // Cleanup temp file
  try {
    unlinkSync(articlePath);
  } catch {
    /* ignore */
  }

  console.log(`[generate] ✓ created DRAFT ${created.id}`);
  console.log(`[generate]    title: ${created.title}`);
  console.log(`[generate]    review at: /admin → article ${created.id}`);
}

async function main() {
  const { slot, custom, daily } = parseArgs();

  if (daily) {
    console.log(`[generate] daily mode: running ${SLOTS.length} slots`);
    for (const s of SLOTS) {
      try {
        await generate(s);
      } catch (err) {
        console.error(`[generate] slot=${s} FAILED:`, err);
      }
    }
  } else if (slot === "custom") {
    if (!custom) {
      console.error("--custom='your prompt' is required when --slot=custom");
      process.exit(1);
    }
    await generate("custom", custom);
  } else if (slot && SLOTS.includes(slot)) {
    await generate(slot);
  } else {
    console.error(
      `Usage:
  npm run generate -- --slot=<slot>
  npm run generate -- --slot=custom --custom="your prompt"
  npm run generate -- --daily

Slots: ${SLOTS.join(", ")}, custom`,
    );
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
