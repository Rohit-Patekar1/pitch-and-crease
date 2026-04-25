/**
 * scripts/publish-scheduled.ts
 *
 * Finds articles whose status is SCHEDULED and whose scheduledFor is in the
 * past, and flips them to PUBLISHED. Run on a cron (Railway Cron, GitHub
 * Actions, or your laptop's launchd) every 5 minutes.
 *
 *   npm run publish:scheduled
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const due = await prisma.article.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    select: { id: true, slug: true, title: true, scheduledFor: true },
  });

  if (due.length === 0) {
    console.log(`[publish-scheduled] nothing to publish at ${now.toISOString()}`);
    return;
  }

  console.log(`[publish-scheduled] publishing ${due.length} article(s):`);
  for (const a of due) {
    console.log(`  - ${a.slug} (was scheduled for ${a.scheduledFor?.toISOString()})`);
  }

  await prisma.article.updateMany({
    where: { id: { in: due.map((a) => a.id) } },
    data: { status: "PUBLISHED", publishedAt: now },
  });

  console.log(`[publish-scheduled] ✓ done`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
