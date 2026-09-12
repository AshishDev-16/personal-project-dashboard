import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";

import type {
  PaymentMap,
  PaymentRecord,
} from "@/lib/types";

export const runtime = "nodejs";

const COLLECTION = "dynamo_payments";

const SEED_REPO =
  "dynamo-06d0dc3-build-dependency-and-release-management";

const SEED_PAYMENT: PaymentRecord = {
  status: "Credited",

  expectedAmount: null,

  creditedAmount: 80,

  currency: "USD",

  creditedAt: "2026-09-12",

  reference: "",

  notes: "",
};


async function migrateOldTerminology() {
  const db = await getDb();

  const collection =
    db.collection(COLLECTION);

  const now = new Date();

  /*
   * Old database records used Paid / Not Paid.
   */
  await collection.updateMany(
    {
      status: "Paid",
    },
    {
      $set: {
        status: "Credited",
        updatedAt: now,
      },
    }
  );

  await collection.updateMany(
    {
      status: "Not Paid",
    },
    {
      $set: {
        status: "Not Credited",
        updatedAt: now,
      },
    }
  );

  /*
   * Migrate the old receivedAmount field.
   */
  const oldAmountDocs =
    await collection
      .find({
        creditedAmount: {
          $exists: false,
        },
        receivedAmount: {
          $exists: true,
        },
      })
      .toArray();

  for (const document of oldAmountDocs) {
    await collection.updateOne(
      {
        _id: document._id,
      },
      {
        $set: {
          creditedAmount:
            document.receivedAmount ?? null,

          creditedAt:
            document.paidAt ?? null,

          updatedAt: now,
        },

        $unset: {
          receivedAmount: "",
          paidAt: "",
        },
      }
    );
  }
}


async function ensureSeedPayment() {
  const db = await getDb();

  const collection =
    db.collection(COLLECTION);

  const now = new Date();

  await collection.updateOne(
    {
      repo: SEED_REPO,
    },
    {
      $setOnInsert: {
        repo: SEED_REPO,

        prNumber: 5,

        ...SEED_PAYMENT,

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
    await migrateOldTerminology();

    await ensureSeedPayment();

    const db = await getDb();

    const documents = await db
      .collection(COLLECTION)
      .find({})
      .toArray();

    const payments: PaymentMap = {};

    for (const document of documents) {
      if (
        typeof document.repo !== "string"
      ) {
        continue;
      }

      payments[document.repo] = {
        status:
          document.status === "Credited"
            ? "Credited"
            : "Not Credited",

        expectedAmount:
          typeof document.expectedAmount ===
          "number"
            ? document.expectedAmount
            : null,

        creditedAmount:
          typeof document.creditedAmount ===
          "number"
            ? document.creditedAmount
            : null,

        currency:
          document.currency === "INR"
            ? "INR"
            : "USD",

        creditedAt:
          typeof document.creditedAt ===
          "string"
            ? document.creditedAt
            : null,

        reference:
          typeof document.reference ===
          "string"
            ? document.reference
            : "",

        notes:
          typeof document.notes ===
          "string"
            ? document.notes
            : "",
      };
    }

    return NextResponse.json({
      payments,
    });
  } catch (error) {
    console.error(
      "Failed to load Dynamo credits:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load Dynamo credits",
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
    const body = await request.json();

    const repo = body.repo as string;

    const payment =
      body.payment as PaymentRecord;

    if (
      !repo ||
      !payment ||
      typeof repo !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid credit record",
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
          repo,
        },
        {
          $set: {
            status:
              payment.status,

            expectedAmount:
              payment.expectedAmount,

            creditedAmount:
              payment.creditedAmount,

            currency:
              payment.currency,

            creditedAt:
              payment.creditedAt,

            reference:
              payment.reference,

            notes:
              payment.notes,

            updatedAt:
              now,
          },

          $setOnInsert: {
            repo,
            createdAt: now,
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
      "Failed to save Dynamo credit:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not save Dynamo credit",
      },
      {
        status: 500,
      }
    );
  }
}


export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const payments =
      body.payments as PaymentMap;

    if (
      !payments ||
      typeof payments !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid credit map",
        },
        {
          status: 400,
        }
      );
    }

    const entries =
      Object.entries(payments);

    if (!entries.length) {
      return NextResponse.json({
        success: true,
      });
    }

    const db = await getDb();

    const now = new Date();

    await db
      .collection(COLLECTION)
      .bulkWrite(
        entries.map(
          ([repo, payment]) => {
            /*
             * Backwards compatibility with
             * old exported backups.
             */
            const legacy =
              payment as PaymentRecord & {
                receivedAmount?:
                  number | null;

                paidAt?:
                  string | null;
              };

            return {
              updateOne: {
                filter: {
                  repo,
                },

                update: {
                  $set: {
                    status:
                      legacy.status ===
                        "Credited"
                        ? "Credited"
                        : legacy.status ===
                            ("Paid" as never)
                          ? "Credited"
                          : "Not Credited",

                    expectedAmount:
                      legacy.expectedAmount ??
                      null,

                    creditedAmount:
                      legacy.creditedAmount ??
                      legacy.receivedAmount ??
                      null,

                    currency:
                      legacy.currency ===
                        "INR"
                        ? "INR"
                        : "USD",

                    creditedAt:
                      legacy.creditedAt ??
                      legacy.paidAt ??
                      null,

                    reference:
                      legacy.reference ?? "",

                    notes:
                      legacy.notes ?? "",

                    updatedAt: now,
                  },

                  $setOnInsert: {
                    repo,
                    createdAt: now,
                  },
                },

                upsert: true,
              },
            };
          }
        )
      );

    await ensureSeedPayment();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Failed to import Dynamo credits:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not import Dynamo credits",
      },
      {
        status: 500,
      }
    );
  }
}