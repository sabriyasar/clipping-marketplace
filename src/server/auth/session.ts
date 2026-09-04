import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "clipping_session";

const secret = process.env.SESSION_SECRET;

if (!secret) {
  throw new Error("SESSION_SECRET is not configured");
}

const secretKey = new TextEncoder().encode(secret);

export async function createSessionToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (typeof payload.userId !== "string") {
      return null;
    }

    return {
      userId: payload.userId,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
