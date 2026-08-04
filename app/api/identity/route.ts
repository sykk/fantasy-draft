import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "draftlab-user";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/welcome?error=1", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, name, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return NextResponse.redirect(new URL("/", request.url));
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
