export const SESSION_COOKIE =
  "dashboard_session";

export const SESSION_DURATION_MS =
  10 * 60 * 1000;

type SessionPayload = {
  iat: number;
  exp: number;
};


const encoder =
  new TextEncoder();


function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary = "";

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlToBytes(
  value: string
) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding =
    "=".repeat(
      (4 -
        (normalized.length % 4)) %
        4
    );

  const binary =
    atob(normalized + padding);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index < binary.length;
    index++
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}


function encodePayload(
  payload: SessionPayload
) {
  return bytesToBase64Url(
    encoder.encode(
      JSON.stringify(payload)
    )
  );
}


function decodePayload(
  encoded: string
): SessionPayload | null {
  try {
    const bytes =
      base64UrlToBytes(encoded);

    const json =
      new TextDecoder().decode(
        bytes
      );

    const payload =
      JSON.parse(json);

    if (
      typeof payload.iat !==
        "number" ||
      typeof payload.exp !==
        "number"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}


async function getSigningKey() {
  const secret =
    process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET is missing"
    );
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    [
      "sign",
      "verify",
    ]
  );
}


export async function
createSessionToken() {
  const now = Date.now();

  const payload:
    SessionPayload = {
      iat: now,

      exp:
        now +
        SESSION_DURATION_MS,
    };

  const encodedPayload =
    encodePayload(payload);

  const key =
    await getSigningKey();

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        encodedPayload
      )
    );

  const encodedSignature =
    bytesToBase64Url(
      new Uint8Array(
        signature
      )
    );

  return {
    token:
      `${encodedPayload}.${encodedSignature}`,

    expiresAt:
      payload.exp,
  };
}


export async function
verifySessionToken(
  token:
    | string
    | undefined
    | null
): Promise<SessionPayload | null> {

  if (!token) {
    return null;
  }

  const [
    encodedPayload,
    encodedSignature,
  ] = token.split(".");

  if (
    !encodedPayload ||
    !encodedSignature
  ) {
    return null;
  }

  try {
    if (
      !process.env.SESSION_SECRET
    ) {
      return null;
    }

    const key =
      await getSigningKey();

    const validSignature =
      await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlToBytes(
          encodedSignature
        ),
        encoder.encode(
          encodedPayload
        )
      );

    if (!validSignature) {
      return null;
    }

    const payload =
      decodePayload(
        encodedPayload
      );

    if (!payload) {
      return null;
    }

    if (
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}


export async function
safeSecretCompare(
  first: string,
  second: string
) {
  const [
    firstHash,
    secondHash,
  ] =
    await Promise.all([
      crypto.subtle.digest(
        "SHA-256",
        encoder.encode(first)
      ),

      crypto.subtle.digest(
        "SHA-256",
        encoder.encode(second)
      ),
    ]);

  const firstBytes =
    new Uint8Array(
      firstHash
    );

  const secondBytes =
    new Uint8Array(
      secondHash
    );

  let difference = 0;

  for (
    let index = 0;
    index < firstBytes.length;
    index++
  ) {
    difference |=
      firstBytes[index] ^
      secondBytes[index];
  }

  return difference === 0;
}