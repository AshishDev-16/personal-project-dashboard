import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";


const PUBLIC_PATHS = new Set([
  "/login",

  "/api/auth/login",

  "/api/auth/logout",
]);


export default async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;


  /*
   * Public authentication routes.
   */
  if (
    PUBLIC_PATHS.has(
      pathname
    )
  ) {
    /*
     * If already authenticated,
     * don't show PIN screen again.
     */
    if (
      pathname === "/login"
    ) {
      const token =
        request.cookies.get(
          SESSION_COOKIE
        )?.value;

      const session =
        await verifySessionToken(
          token
        );

      if (session) {
        return NextResponse.redirect(
          new URL(
            "/",
            request.url
          )
        );
      }
    }

    return NextResponse.next();
  }


  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;


  const session =
    await verifySessionToken(
      token
    );


  if (!session) {
    /*
     * APIs return proper 401 instead
     * of an HTML redirect.
     */
    if (
      pathname.startsWith(
        "/api/"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }


    return NextResponse.redirect(
      new URL(
        "/login",
        request.url
      )
    );
  }


  return NextResponse.next();
}


export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};