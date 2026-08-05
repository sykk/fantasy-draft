import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { IDENTITY_COOKIE } from "@/lib/identity";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/welcome?error=1", request.url), { status: 303 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IDENTITY_COOKIE, name, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(IDENTITY_COOKIE);
  return NextResponse.json({ ok: true });
}
