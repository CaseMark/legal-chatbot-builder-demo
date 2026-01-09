/**
 * Next.js Proxy
 *
 * For demo mode, all routes are accessible without authentication.
 * When you're ready to add authentication, uncomment the auth logic below.
 *
 * @see skills/auth/SKILL.md for detailed documentation
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Demo mode: Allow all routes without authentication
  return NextResponse.next();

  // ============================================================================
  // AUTHENTICATION (Uncomment when ready to enable auth)
  // ============================================================================
  // 
  // const { pathname } = request.nextUrl;
  // 
  // // Routes that don't require authentication
  // const publicRoutes = [
  //   "/",
  //   "/login",
  //   "/signup",
  //   "/api/auth",
  //   "/api/chat",
  //   "/api/embeddings",
  //   "/api/chatbots",
  //   "/api/demo",
  //   "/chatbots",
  // ];
  // 
  // // Check if this is a public route
  // const isPublicRoute = publicRoutes.some(
  //   (route) => pathname === route || pathname.startsWith(`${route}/`)
  // );
  // 
  // if (isPublicRoute) {
  //   return NextResponse.next();
  // }
  // 
  // // Check for session cookie
  // const sessionCookie = request.cookies.get("better-auth.session_token");
  // 
  // if (!sessionCookie) {
  //   const loginUrl = new URL("/login", request.url);
  //   loginUrl.searchParams.set("callbackUrl", pathname);
  //   return NextResponse.redirect(loginUrl);
  // }
  // 
  // return NextResponse.next();
}

/**
 * Configure which routes the proxy runs on
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js)$).*)",
  ],
};
