import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import type {
  LumiereState,
} from "@/lib/types";

export const runtime = "nodejs";

const COLLECTION = "lumiere_state";

const STATE_KEY =
  "lumiere-engineering";


export async function GET() {
  try {
    const db = await getDb();

    const document = await db
      .collection(COLLECTION)
      .findOne({
        key: STATE_KEY,
      });

    if (!document) {
      return NextResponse.json({
        state: null,
      });
    }

    const state: LumiereState = {
      tasks: Array.isArray(
        document.tasks
      )
        ? document.tasks
        : [],

      settings: {
        amountPerAcceptedTask:
          typeof document.settings
            ?.amountPerAcceptedTask ===
          "number"
            ? document.settings
                .amountPerAcceptedTask
            : 0,

        currency:
          document.settings?.currency ===
          "INR"
            ? "INR"
            : "USD",
      },
    };

    return NextResponse.json({
      state,
    });
  } catch (error) {
    console.error(
      "Failed to load Lumiere state:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load Lumiere state",
      },
      {
        status: 500,
      }
    );
  }
}


export async function PUT(
  request: Request
) {
  try {
    const body =
      (await request.json()) as LumiereState;

    if (
      !body ||
      !Array.isArray(body.tasks) ||
      !body.settings
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Lumiere state",
        },
        {
          status: 400,
        }
      );
    }

    const db = await getDb();

    const now = new Date();

    await db
      .collection(COLLECTION)
      .updateOne(
        {
          key: STATE_KEY,
        },
        {
          $set: {
            tasks:
              body.tasks,

            settings:
              body.settings,

            updatedAt:
              now,
          },

          $setOnInsert: {
            key:
              STATE_KEY,

            createdAt:
              now,
          },
        },
        {
          upsert: true,
        }
      );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Failed to save Lumiere state:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not save Lumiere state",
      },
      {
        status: 500,
      }
    );
  }
}