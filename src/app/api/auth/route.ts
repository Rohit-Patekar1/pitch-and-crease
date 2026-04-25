import { NextResponse } from "next/server";
import { checkPassword, makeSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (!password) return NextResponse.json({ error: "no password" }, { status: 400 });
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  setSessionCookie(makeSessionToken());
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
