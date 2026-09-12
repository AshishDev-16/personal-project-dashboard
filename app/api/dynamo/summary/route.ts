import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";

import type {
  DynamoSummary,
} from "@/lib/types";

export const runtime = "nodejs";

const COLLECTION =
  "project_settings";

const PROJECT =
  "dynamo";


const DEFAULT_SUMMARY:
  DynamoSummary = {
    currency: "USD",

    paidOutToBank: 987.71,

    awaitingPayout: 280,
  };


async function ensureSummary() {
  const db = await getDb();

  const now = new Date();

  await db
    .collection(COLLECTION)
    .updateOne(
      {
        project: PROJECT,
      },
      {
        $setOnInsert: {
          project: PROJECT,

          ...DEFAULT_SUMMARY,

          createdAt: now,

          updatedAt: now,
        },
      },
      {
        upsert: true,
      }
    );
}


export async function GET() {
  try {
    await ensureSummary();

    const db = await getDb();

    const document =
      await db
        .collection(COLLECTION)
        .findOne({
          project: PROJECT,
        });

    const summary:
      DynamoSummary = {
        currency:
          document?.currency === "INR"
            ? "INR"
            : "USD",

        paidOutToBank:
          typeof document
            ?.paidOutToBank === "number"
            ? document.paidOutToBank
            : 0,

        awaitingPayout:
          typeof document
            ?.awaitingPayout === "number"
            ? document.awaitingPayout
            : 0,
      };

    return NextResponse.json({
      summary,
    });
  } catch (error) {
    console.error(
      "Failed to load Dynamo summary:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load Dynamo summary",
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
      (await request.json()) as
        DynamoSummary;

    if (
      !body ||
      typeof body.paidOutToBank !==
        "number" ||
      typeof body.awaitingPayout !==
        "number"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Dynamo summary",
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
          project: PROJECT,
        },
        {
          $set: {
            currency:
              body.currency === "INR"
                ? "INR"
                : "USD",

            paidOutToBank:
              body.paidOutToBank,

            awaitingPayout:
              body.awaitingPayout,

            updatedAt:
              now,
          },

          $setOnInsert: {
            project:
              PROJECT,

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
      "Failed to save Dynamo summary:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not save Dynamo summary",
      },
      {
        status: 500,
      }
    );
  }
}