import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

const ARTICLE_SLOTS = [
  "custom",
  "on-this-day",
  "recent-match",
  "transfer",
  "tactics",
  "player",
] as const;

const SOCIAL_SLOTS = [
  "custom",
  "on-this-day",
  "stat-moment",
  "quick-take",
  "transfer-flash",
] as const;

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const contentType = String(body.contentType ?? "ARTICLE") as "ARTICLE" | "SOCIAL";
  const prompt = String(body.prompt ?? "").trim();
  const slot = String(body.slot ?? "custom");

  if (contentType !== "ARTICLE" && contentType !== "SOCIAL") {
    return NextResponse.json({ error: "invalid contentType" }, { status: 400 });
  }
  const validSlots: readonly string[] = contentType === "ARTICLE" ? ARTICLE_SLOTS : SOCIAL_SLOTS;
  if (!validSlots.includes(slot)) {
    return NextResponse.json({ error: "invalid slot for contentType" }, { status: 400 });
  }
  if (!prompt && slot === "custom") {
    return NextResponse.json({ error: "prompt is required for custom slot" }, { status: 400 });
  }

  const created = await prisma.generationRequest.create({
    data: {
      contentType,
      prompt: prompt || `[${slot}]`,
      slot,
      status: "PENDING",
    },
  });
  return NextResponse.json(created, { status: 201 });
}
