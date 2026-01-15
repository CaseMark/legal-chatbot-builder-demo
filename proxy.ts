/**
 * Next.js Proxy
 *
 * For demo mode, all routes are accessible without authentication.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Demo mode: Allow all routes without authentication
  return NextResponse.next();
}

/**
 * Configure which routes the proxy runs on
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js)$).*)",
  ],
};
