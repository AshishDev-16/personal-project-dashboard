import {
  NextResponse,
} from "next/server";

import {
  createSessionToken,
  safeSecretCompare,
  SESSION_COOKIE,
} from "@/lib/auth";

import {
  getDb,
} from "@/lib/mongodb";


export const runtime =
  "nodejs";


const MAX_ATTEMPTS = 5;

const LOCK_TIME_MS =
  15 * 60 * 1000;


function getClientKey(
  request: Request
) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for"
    );

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  return (
    forwarded
      ?.split(",")[0]
      ?.trim() ||
    realIp ||
    "unknown"
  );
}


export async function POST(
  request: Request
) {
  try {
    const expectedPin =
      process.env.DASHBOARD_PIN;

    if (!expectedPin) {
      console.error(
        "DASHBOARD_PIN is missing"
      );

      return NextResponse.json(
        {
          error:
            "Authentication is not configured",
        },
        {
          status: 500,
        }
      );
    }


    const body =
      await request.json();

    const pin =
      String(
        body?.pin ?? ""
      );

    const clientKey =
      getClientKey(request);

    const db =
      await getDb();

    const attempts =
      db.collection(
        "auth_attempts"
      );

    const now =
      new Date();

    const nowMs =
      now.getTime();

    const current =
      await attempts.findOne({
        key: clientKey,
      });


    /*
     * Existing lockout.
     */
    if (
      current?.lockedUntil
        instanceof Date &&
      current.lockedUntil.getTime() >
        nowMs
    ) {
      const retryAfter =
        Math.ceil(
          (
            current.lockedUntil
              .getTime() -
            nowMs
          ) /
            1000
        );

      return NextResponse.json(
        {
          error:
            "Too many incorrect attempts. Try again later.",

          retryAfter,
        },
        {
          status: 429,
        }
      );
    }


    const correct =
      await safeSecretCompare(
        pin,
        expectedPin
      );


    if (!correct) {
      const previousWindow =
        current?.windowStart
          instanceof Date
          ? current.windowStart
          : null;

      const stillInWindow =
        previousWindow &&
        nowMs -
          previousWindow.getTime() <
          LOCK_TIME_MS;

      const count =
        stillInWindow
          ? Number(
              current?.count ?? 0
            ) + 1
          : 1;

      const lockedUntil =
        count >= MAX_ATTEMPTS
          ? new Date(
              nowMs +
                LOCK_TIME_MS
            )
          : null;

      await attempts.updateOne(
        {
          key: clientKey,
        },
        {
          $set: {
            count,

            windowStart:
              stillInWindow
                ? previousWindow
                : now,

            lockedUntil,

            updatedAt: now,
          },
        },
        {
          upsert: true,
        }
      );


      return NextResponse.json(
        {
          error:
            count >=
            MAX_ATTEMPTS
              ? "Too many incorrect attempts. Locked for 15 minutes."
              : "Incorrect PIN",
        },
        {
          status:
            count >=
            MAX_ATTEMPTS
              ? 429
              : 401,
        }
      );
    }


    /*
     * Correct PIN clears failed
     * attempts.
     */
    await attempts.deleteOne({
      key: clientKey,
    });


    const {
      token,
      expiresAt,
    } =
      await createSessionToken();


    const response =
      NextResponse.json({
        success: true,

        expiresAt,
      });


    response.cookies.set({
      name:
        SESSION_COOKIE,

      value:
        token,

      httpOnly:
        true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite:
        "strict",

      path:
        "/",

      maxAge:
        10 * 60,
    });


    return response;
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Authentication failed",
      },
      {
        status: 500,
      }
    );
  }
}