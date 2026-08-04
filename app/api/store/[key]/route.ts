import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvSet } from "@/lib/kv";

async function currentUserOrNull(): Promise<string | null> {
  const cookieStore = await cookies();
  const name = cookieStore.get("draftlab-user")?.value;
  return name ? name.trim().toLowerCase() : null;
}

function scopedKey(username: string, key: string): string {
  return `${username}:${key}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  const value = await kvGet(scopedKey(username, key));
  return NextResponse.json({ value });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  const { value } = (await request.json()) as { value: string };
  await kvSet(scopedKey(username, key), value);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const username = await currentUserOrNull();
  if (!username) return NextResponse.json({ error: "no identity" }, { status: 401 });

  const { key } = await params;
  await kvDelete(scopedKey(username, key));
  return new NextResponse(null, { status: 204 });
}
