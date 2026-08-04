import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasIdentity = request.cookies.has("draftlab-user");
  const { pathname } = request.nextUrl;

  if (!hasIdentity && pathname !== "/welcome" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
