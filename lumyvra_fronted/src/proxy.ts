import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "./lib/auth-routing";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/" || path === "/login") return NextResponse.next();
  const session = request.cookies.get("lumyvra_session")?.value;
  // Go remains the authority for session expiry, revocation and per-resource ownership.
  if (session && /^[a-f0-9]{64}$/.test(session)) {
    try {
      const result = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:8080"}/api/me`, {
        headers: { Cookie: `lumyvra_session=${session}` },
        cache: "no-store", signal: AbortSignal.timeout(4000),
      });
      if (result.ok && (await result.json()).user?.id) return NextResponse.next();
    } catch { /* Fail closed when the session cannot be verified. */ }
  }
  const destination = new URL(loginPath(path + request.nextUrl.search), request.url);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|assets(?:/|$)|media(?:/|$)|favicon.ico$|robots.txt$|sitemap.xml$).*)"],
};
