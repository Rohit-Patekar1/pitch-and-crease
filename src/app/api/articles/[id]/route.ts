import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const allowed = ["title", "dek", "body", "status", "scheduledFor", "twitterThread", "facebookCopy"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields" }, { status: 400 });
  }
  const updated = await prisma.article.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
