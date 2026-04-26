import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

const VALID_SLOTS = [
  "custom",
  "on-this-day",
  "recent-match",
  "transfer",
  "tactics",
  "player",
] as const;

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  const slot = String(body.slot ?? "custom");

  if (!prompt && slot === "custom") {
    return NextResponse.json({ error: "prompt is required for custom slot" }, { status: 400 });
  }
  if (!VALID_SLOTS.includes(slot as (typeof VALID_SLOTS)[number])) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  }

  const created = await prisma.generationRequest.create({
    data: { prompt: prompt || `[${slot}]`, slot, status: "PENDING" },
  });
  return NextResponse.json(created, { status: 201 });
}
