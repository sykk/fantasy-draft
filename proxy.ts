import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IDENTITY_COOKIE } from "@/lib/identity";

export function proxy(request: NextRequest) {
  const hasIdentity = request.cookies.has(IDENTITY_COOKIE);
  const { pathname } = request.nextUrl;

  if (!hasIdentity && pathname !== "/welcome" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
